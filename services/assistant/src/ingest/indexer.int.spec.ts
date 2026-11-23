/**
 * Test tích hợp với Postgres thật đã chạy migration `AssistantSchema` của backend (cần extension vector, unaccent).
 * Chỉ chạy khi có TEST_DB_URL, ví dụ: TEST_DB_URL=postgres://hr:hr@localhost:5432/hr npm test
 */
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { reindex } from '../cli/reindex-embeddings';
import { HashEmbedder } from '../rag/embedders/hash';
import { FileReader } from '../storage';
import { makeDocx, makePdf } from '../test-support/fixtures';
import { DOCX, PDF } from './extract';
import { Indexer } from './indexer';

const url = process.env.TEST_DB_URL;
const d = url ? describe : describe.skip;

class MemoryFiles implements FileReader {
  files = new Map<string, Buffer>();
  async read(key: string): Promise<Buffer> {
    const f = this.files.get(key);
    if (!f) throw new Error(`no such key ${key}`);
    return f;
  }
}

d('Indexer (Postgres)', () => {
  let pool: Pool;
  const files = new MemoryFiles();
  const embedder = new HashEmbedder(256);
  let indexer: Indexer;
  const docIds: string[] = [];
  const dept = randomUUID();

  const published = (documentId: string, versionNo: number, objectKey: string, contentType = DOCX, extra: object = {}) => ({
    id: randomUUID(),
    type: 'DocumentPublished',
    payload: {
      documentId,
      versionId: randomUUID(),
      versionNo,
      objectKey,
      contentType,
      title: 'Quy chế nghỉ phép',
      type: 'POLICY',
      scope: { all: false, departmentIds: [dept], roles: ['HR'] },
      hidden: false,
      occurredAt: new Date().toISOString(),
      ...extra,
    },
  });

  const newDoc = () => {
    const id = randomUUID();
    docIds.push(id);
    return id;
  };

  const chunks = async (id: string) =>
    (await pool.query('SELECT ord, heading, content, version_id FROM assistant.chunk WHERE document_id = $1 ORDER BY ord', [id])).rows;
  const doc = async (id: string) => (await pool.query('SELECT * FROM assistant.document WHERE id = $1', [id])).rows[0];

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    indexer = new Indexer(pool, files, embedder);
    files.files.set(
      'v1.docx',
      await makeDocx([
        { text: 'Điều 5. Nghỉ việc riêng' },
        { text: 'Người lao động kết hôn được nghỉ 3 ngày hưởng nguyên lương.' },
        { text: 'Điều 6. Nghỉ không lương' },
        { text: 'Tối đa 30 ngày mỗi năm.' },
      ]),
    );
    files.files.set('v2.docx', await makeDocx([{ text: 'Điều 5. Nghỉ việc riêng' }, { text: 'Kết hôn được nghỉ 5 ngày.' }]));
    files.files.set('empty.pdf', makePdf([[]]));
  });

  afterAll(async () => {
    if (docIds.length) await pool.query('DELETE FROM assistant.document WHERE id = ANY($1)', [docIds]);
    await pool.end();
  });

  it('index tài liệu: đoạn theo điều, tsv không dấu, vector theo model, metadata phạm vi', async () => {
    const id = newDoc();
    expect(await indexer.handle(published(id, 1, 'v1.docx'))).toBe(true);
    const rows = await chunks(id);
    expect(rows.map((r) => r.heading)).toEqual(['Điều 5. Nghỉ việc riêng', 'Điều 6. Nghỉ không lương']);
    const d1 = await doc(id);
    expect(d1).toMatchObject({ index_status: 'INDEXED', version_no: 1, scope_all: false, scope_department_ids: [dept], scope_roles: ['HR'] });
    // Full-text không dấu: "ket hon" khớp "kết hôn".
    const fts = await pool.query(
      `SELECT ord FROM assistant.chunk WHERE document_id = $1 AND tsv @@ plainto_tsquery('simple', unaccent('ket hon'))`,
      [id],
    );
    expect(fts.rows.map((r) => r.ord)).toEqual([0]);
    // Vector: câu hỏi gần đoạn về kết hôn nhất.
    const q = await embedder.embedQuery('kết hôn nghỉ mấy ngày');
    const near = await pool.query(
      `SELECT c.ord FROM assistant.chunk_embedding e JOIN assistant.chunk c ON c.id = e.chunk_id
       WHERE c.document_id = $1 AND e.model = $2 ORDER BY e.embedding <=> $3::vector LIMIT 1`,
      [id, embedder.id, `[${q.join(',')}]`],
    );
    expect(near.rows[0].ord).toBe(0);
  });

  it('chống trùng event theo id', async () => {
    const id = newDoc();
    const e = published(id, 1, 'v1.docx');
    expect(await indexer.handle(e)).toBe(true);
    expect(await indexer.handle(e)).toBe(false);
  });

  it('phiên bản mới thay toàn bộ đoạn cũ; event phiên bản cũ đến muộn bị bỏ qua', async () => {
    const id = newDoc();
    await indexer.handle(published(id, 1, 'v1.docx'));
    const v2 = published(id, 2, 'v2.docx');
    await indexer.handle(v2);
    let rows = await chunks(id);
    expect(rows).toHaveLength(1);
    expect(rows[0].content).toContain('5 ngày');
    expect(rows[0].version_id).toBe(v2.payload.versionId);

    await indexer.handle(published(id, 1, 'v1.docx'));
    rows = await chunks(id);
    expect(rows).toHaveLength(1);
    expect((await doc(id)).version_no).toBe(2);
  });

  it('file không có chữ: FAILED, xóa đoạn cũ, không ném lỗi', async () => {
    const id = newDoc();
    await indexer.handle(published(id, 1, 'v1.docx'));
    await indexer.handle(published(id, 2, 'empty.pdf', PDF));
    expect(await chunks(id)).toHaveLength(0);
    expect((await doc(id)).index_status).toBe('FAILED');
  });

  it('lỗi storage thì ném lỗi (queue thử lại) và không đánh dấu đã xử lý', async () => {
    const id = newDoc();
    const e = published(id, 1, 'missing.docx');
    await expect(indexer.handle(e)).rejects.toThrow(/no such key/);
    const seen = await pool.query('SELECT 1 FROM assistant.processed_event WHERE event_id = $1', [e.id]);
    expect(seen.rowCount).toBe(0);
  });

  it('payload sai thì ném lỗi, không ghi gì', async () => {
    const id = newDoc();
    const e = published(id, 1, 'v1.docx', DOCX, { scope: { all: false, departmentIds: ['x'], roles: [] } });
    await expect(indexer.handle(e)).rejects.toThrow(/uuid/);
    expect(await doc(id)).toBeUndefined();
  });

  it('DocumentUpdated, Hidden, Restored chỉ cập nhật metadata', async () => {
    const id = newDoc();
    await indexer.handle(published(id, 1, 'v1.docx'));
    await indexer.handle({
      id: randomUUID(),
      type: 'DocumentUpdated',
      payload: { documentId: id, title: 'Tên mới', type: 'GUIDE', scope: { all: true, departmentIds: [], roles: [] }, occurredAt: '' },
    });
    await indexer.handle({ id: randomUUID(), type: 'DocumentHidden', payload: { documentId: id, occurredAt: '' } });
    expect(await doc(id)).toMatchObject({ title: 'Tên mới', type: 'GUIDE', scope_all: true, hidden: true, version_no: 1 });
    expect(await chunks(id)).toHaveLength(2);
    await indexer.handle({ id: randomUUID(), type: 'DocumentRestored', payload: { documentId: id, occurredAt: '' } });
    expect((await doc(id)).hidden).toBe(false);
  });

  it('reindex-embeddings: ghi vector model mới song song, rồi xóa vector model cũ', async () => {
    const id = newDoc();
    await indexer.handle(published(id, 1, 'v1.docx'));
    const other = new HashEmbedder(64);
    const r1 = await reindex(pool, other, false);
    expect(r1.embedded).toBeGreaterThanOrEqual(2);
    const models = async () =>
      (
        await pool.query(
          `SELECT DISTINCT e.model FROM assistant.chunk_embedding e JOIN assistant.chunk c ON c.id = e.chunk_id WHERE c.document_id = $1 ORDER BY 1`,
          [id],
        )
      ).rows.map((r) => r.model);
    expect(await models()).toEqual(['hash-256', 'hash-64']);
    // Chạy lại không tính lại đoạn đã có vector.
    expect((await reindex(pool, other, false)).embedded).toBe(0);
    await reindex(pool, other, true);
    expect(await models()).toEqual(['hash-64']);
    // Trả lại model mặc định của các test khác.
    await reindex(pool, embedder, true);
  });
});
