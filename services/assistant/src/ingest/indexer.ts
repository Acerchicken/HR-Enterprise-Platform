import { Pool, PoolClient } from 'pg';
import { errorText, log } from '../log';
import { RAG_SETTINGS } from '../rag/settings';
import { Embedder, toPgVector } from '../rag/embedders/embedder';
import { FileReader } from '../storage';
import { Chunk, chunkSections } from './chunker';
import { checkDocumentId, checkScope, DocumentPublished, DocumentUpdated } from './events';
import { ExtractError, extractSections } from './extract';
import { IncomingEvent } from '../messaging/consumer';

/**
 * Ghi index của trợ lý từ event tài liệu (UC6 spec 13.1, 13.2):
 * - `DocumentPublished`: đọc file, trích văn bản, chia đoạn, tính embedding, thay toàn bộ đoạn cũ trong một giao dịch.
 *   Phiên bản cũ hơn bản đã index thì bỏ qua (event có thể đến lệch thứ tự).
 * - `DocumentUpdated`, `DocumentHidden`, `DocumentRestored`: chỉ cập nhật `assistant.document`.
 * Thứ tự: id event là id `leave.outbox` (tăng dần). Queue không giữ thứ tự (SQS Standard, đẩy lại từ DLQ), nên metadata
 * (tiêu đề, loại, phạm vi) chỉ ghi khi id lớn hơn `meta_event_id`, `hidden` chỉ ghi khi id lớn hơn `visibility_event_id`.
 * Nhờ vậy event cũ đến sau không làm hiện lại tài liệu đã ẩn, không nới lại phạm vi đã thu hẹp.
 * File không trích được chữ: ghi `FAILED`, xóa đoạn cũ (trợ lý không dùng tài liệu đó cho tới khi có bản mới), không ném lỗi.
 * Lỗi tạm thời (storage, database) thì ném lỗi để queue thử lại hoặc chuyển DLQ.
 */
export class Indexer {
  constructor(
    private readonly pool: Pool,
    private readonly files: FileReader,
    private readonly embedder: Embedder,
  ) {}

  /** Xử lý một event, chống trùng theo id (queue giao ít nhất một lần). Trả false nếu bỏ qua. */
  async handle(e: IncomingEvent): Promise<boolean> {
    if (!e.id) throw new Error('Event thiếu id');
    const seen = await this.pool.query('SELECT 1 FROM assistant.processed_event WHERE event_id = $1', [e.id]);
    if (seen.rowCount) return false;
    switch (e.type) {
      case 'DocumentPublished':
        await this.published(e.payload as DocumentPublished, eventSeq(e.id));
        break;
      case 'DocumentUpdated':
        await this.updated(e.payload as DocumentUpdated, eventSeq(e.id));
        break;
      case 'DocumentHidden':
      case 'DocumentRestored':
        await this.visibility(checkDocumentId(e.payload), e.type === 'DocumentHidden', eventSeq(e.id));
        break;
      default:
        log.warn('Bỏ qua event lạ', { eventId: e.id, type: e.type });
    }
    await this.pool.query('INSERT INTO assistant.processed_event (event_id, event_type) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
      e.id,
      e.type.slice(0, 50),
    ]);
    return true;
  }

  async published(p: DocumentPublished, seq: string): Promise<void> {
    const id = checkDocumentId(p);
    const scope = checkScope(p.scope);
    if (!Number.isInteger(p.versionNo) || typeof p.objectKey !== 'string' || typeof p.versionId !== 'string') {
      throw new Error('Payload DocumentPublished thiếu phiên bản');
    }
    const [current] = (await this.pool.query('SELECT version_no FROM assistant.document WHERE id = $1', [id])).rows;
    if (current?.version_no != null && current.version_no > p.versionNo) {
      log.info('Bỏ qua phiên bản cũ hơn bản đã index', { documentId: id, versionNo: p.versionNo });
      return;
    }
    // Phiên bản luôn ghi (đã kiểm `version_no` ở trên); metadata, `hidden` chỉ ghi khi event này mới hơn mốc đã áp dụng.
    const meta = 'EXCLUDED.meta_event_id > d.meta_event_id';
    const vis = 'EXCLUDED.visibility_event_id > d.visibility_event_id';
    await this.pool.query(
      `INSERT INTO assistant.document AS d (id, title, type, version_id, version_no, hidden, scope_all, scope_department_ids, scope_roles,
         index_status, meta_event_id, visibility_event_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING', $10, $10, now())
       ON CONFLICT (id) DO UPDATE SET version_id = EXCLUDED.version_id, version_no = EXCLUDED.version_no, index_status = 'PENDING',
         title = CASE WHEN ${meta} THEN EXCLUDED.title ELSE d.title END,
         type = CASE WHEN ${meta} THEN EXCLUDED.type ELSE d.type END,
         scope_all = CASE WHEN ${meta} THEN EXCLUDED.scope_all ELSE d.scope_all END,
         scope_department_ids = CASE WHEN ${meta} THEN EXCLUDED.scope_department_ids ELSE d.scope_department_ids END,
         scope_roles = CASE WHEN ${meta} THEN EXCLUDED.scope_roles ELSE d.scope_roles END,
         meta_event_id = GREATEST(d.meta_event_id, EXCLUDED.meta_event_id),
         hidden = CASE WHEN ${vis} THEN EXCLUDED.hidden ELSE d.hidden END,
         visibility_event_id = GREATEST(d.visibility_event_id, EXCLUDED.visibility_event_id),
         updated_at = now()`,
      [id, p.title ?? '', p.type ?? '', p.versionId, p.versionNo, !!p.hidden, scope.all, scope.departmentIds, scope.roles, seq],
    );

    const started = Date.now();
    let chunks: Chunk[];
    try {
      const file = await this.files.read(p.objectKey);
      chunks = chunkSections(await extractSections(file, p.contentType));
    } catch (e) {
      if (!(e instanceof ExtractError)) throw e;
      await this.replaceChunks(id, p.versionId, p.versionNo, [], [], 'FAILED');
      log.warn('Không trích được văn bản, tài liệu không có đoạn', { documentId: id, versionNo: p.versionNo, error: errorText(e) });
      return;
    }

    const vectors: number[][] = [];
    for (let i = 0; i < chunks.length; i += RAG_SETTINGS.embedBatch) {
      const batch = chunks.slice(i, i + RAG_SETTINGS.embedBatch);
      vectors.push(...(await this.embedder.embedDocuments(batch.map((c) => ({ heading: c.heading || p.title, text: c.content })))));
    }
    const done = await this.replaceChunks(id, p.versionId, p.versionNo, chunks, vectors, 'INDEXED');
    if (done) log.info('Đã index tài liệu', { documentId: id, versionNo: p.versionNo, chunks: chunks.length, model: this.embedder.id, ms: Date.now() - started });
  }

  async updated(p: DocumentUpdated, seq: string): Promise<void> {
    const id = checkDocumentId(p);
    const scope = checkScope(p.scope);
    const res = await this.pool.query(
      `INSERT INTO assistant.document AS d (id, title, type, scope_all, scope_department_ids, scope_roles, meta_event_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, type = EXCLUDED.type, scope_all = EXCLUDED.scope_all,
         scope_department_ids = EXCLUDED.scope_department_ids, scope_roles = EXCLUDED.scope_roles,
         meta_event_id = EXCLUDED.meta_event_id, updated_at = now()
       WHERE EXCLUDED.meta_event_id > d.meta_event_id`,
      [id, p.title ?? '', p.type ?? '', scope.all, scope.departmentIds, scope.roles, seq],
    );
    if (!res.rowCount) log.info('Bỏ qua DocumentUpdated cũ hơn metadata đã áp dụng', { documentId: id, eventId: seq });
  }

  async visibility(id: string, hidden: boolean, seq: string): Promise<void> {
    const res = await this.pool.query(
      `INSERT INTO assistant.document AS d (id, hidden, visibility_event_id, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (id) DO UPDATE SET hidden = EXCLUDED.hidden, visibility_event_id = EXCLUDED.visibility_event_id, updated_at = now()
       WHERE EXCLUDED.visibility_event_id > d.visibility_event_id`,
      [id, hidden, seq],
    );
    if (!res.rowCount) log.info('Bỏ qua event ẩn/khôi phục cũ hơn trạng thái đã áp dụng', { documentId: id, eventId: seq });
  }

  /**
   * Thay toàn bộ đoạn và vector của tài liệu trong một giao dịch. Khóa dòng tài liệu và kiểm lại phiên bản: nếu trong lúc
   * tính embedding đã có phiên bản mới hơn được ghi thì bỏ kết quả này. `tsv` tính bằng `unaccent` để "nghi cuoi" khớp
   * "nghỉ cưới".
   */
  private async replaceChunks(
    id: string,
    versionId: string,
    versionNo: number,
    chunks: Chunk[],
    vectors: number[][],
    status: 'INDEXED' | 'FAILED',
  ): Promise<boolean> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const [row] = (await client.query('SELECT version_no FROM assistant.document WHERE id = $1 FOR UPDATE', [id])).rows;
      if (row && row.version_no != null && row.version_no > versionNo) {
        await client.query('ROLLBACK');
        return false;
      }
      await client.query('DELETE FROM assistant.chunk WHERE document_id = $1', [id]);
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        const [inserted] = (
          await client.query(
            `INSERT INTO assistant.chunk (document_id, version_id, ord, heading, content, tsv)
             VALUES ($1, $2, $3, $4, $5, to_tsvector('simple', unaccent($4 || ' ' || $5)))
             RETURNING id`,
            [id, versionId, c.ord, c.heading, c.content],
          )
        ).rows;
        await client.query(`INSERT INTO assistant.chunk_embedding (chunk_id, model, embedding) VALUES ($1, $2, $3::vector)`, [
          inserted.id,
          this.embedder.id,
          toPgVector(vectors[i]),
        ]);
      }
      await client.query(`UPDATE assistant.document SET index_status = $2, updated_at = now() WHERE id = $1`, [id, status]);
      await client.query('COMMIT');
      return true;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  }
}

/**
 * Id event là id `leave.outbox` (bigint, tăng dần), dùng làm mốc thứ tự. Id không phải số nguyên dương thì ném lỗi (vào DLQ):
 * không biết event đó mới hay cũ thì không được ghi đè phạm vi, trạng thái ẩn.
 */
export function eventSeq(id: string): string {
  if (!/^[1-9]\d{0,18}$/.test(id)) throw new Error('Id event không phải id outbox');
  return id;
}
