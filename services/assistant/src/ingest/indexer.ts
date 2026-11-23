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
        await this.published(e.payload as DocumentPublished);
        break;
      case 'DocumentUpdated':
        await this.updated(e.payload as DocumentUpdated);
        break;
      case 'DocumentHidden':
      case 'DocumentRestored':
        await this.visibility(checkDocumentId(e.payload), e.type === 'DocumentHidden');
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

  async published(p: DocumentPublished): Promise<void> {
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
    await this.pool.query(
      `INSERT INTO assistant.document (id, title, type, version_id, version_no, hidden, scope_all, scope_department_ids, scope_roles, index_status, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING', now())
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, type = EXCLUDED.type, version_id = EXCLUDED.version_id,
         version_no = EXCLUDED.version_no, hidden = EXCLUDED.hidden, scope_all = EXCLUDED.scope_all,
         scope_department_ids = EXCLUDED.scope_department_ids, scope_roles = EXCLUDED.scope_roles,
         index_status = 'PENDING', updated_at = now()`,
      [id, p.title ?? '', p.type ?? '', p.versionId, p.versionNo, !!p.hidden, scope.all, scope.departmentIds, scope.roles],
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

  async updated(p: DocumentUpdated): Promise<void> {
    const id = checkDocumentId(p);
    const scope = checkScope(p.scope);
    await this.pool.query(
      `INSERT INTO assistant.document (id, title, type, scope_all, scope_department_ids, scope_roles, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, type = EXCLUDED.type, scope_all = EXCLUDED.scope_all,
         scope_department_ids = EXCLUDED.scope_department_ids, scope_roles = EXCLUDED.scope_roles, updated_at = now()`,
      [id, p.title ?? '', p.type ?? '', scope.all, scope.departmentIds, scope.roles],
    );
  }

  async visibility(id: string, hidden: boolean): Promise<void> {
    await this.pool.query(
      `INSERT INTO assistant.document (id, hidden, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (id) DO UPDATE SET hidden = EXCLUDED.hidden, updated_at = now()`,
      [id, hidden],
    );
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
