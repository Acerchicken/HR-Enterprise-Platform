/**
 * Truy hồi theo phạm vi và luồng trả lời với PostgreSQL thật, LLM giả (UC6 test.md: AC-6.3.2, 6.3.3, 6.3.4, 6.3.7, 6.3.8).
 * Chỉ chạy khi có TEST_DB_URL (database đã chạy migration của backend).
 */
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { Indexer } from '../ingest/indexer';
import { DOCX } from '../ingest/extract';
import { StaticConfigSource } from '../llm/config-source';
import { Passage, SYSTEM_PROMPT } from '../llm/prompt';
import { LlmError, LlmProvider } from '../llm/provider';
import { registerProvider } from '../llm/providers';
import { HashEmbedder } from '../rag/embedders/hash';
import { Retriever } from '../rag/retriever';
import { makeDocx } from '../test-support/fixtures';
import { Answerer, FALLBACK_ANSWER } from './answerer';

const url = process.env.TEST_DB_URL;
const d = url ? describe : describe.skip;

/** LLM giả: ghi lại request, trả theo `reply`. */
class FakeLlm implements LlmProvider {
  calls: Array<{ question: string; passages: Passage[] }> = [];
  reply: (passages: Passage[]) => string | Error = (ps) => `Theo quy định, kết hôn được nghỉ [${ps[0].n}].`;
  async answer(input: { system: string; question: string; passages: Passage[] }) {
    this.calls.push({ question: input.question, passages: input.passages });
    const r = this.reply(input.passages);
    if (r instanceof Error) throw r;
    return { text: r, citedPassages: null, usage: { inputTokens: 10, outputTokens: 5 } };
  }
  async listModels() {
    return [];
  }
  async testConnection() {}
}

d('Answerer + Retriever (Postgres)', () => {
  let pool: Pool;
  const llm = new FakeLlm();
  const configs = new StaticConfigSource({ provider: 'fake', model: 'm', apiKey: 'k', baseUrl: null, enabled: true });
  let answerer: Answerer;
  const unitA = randomUUID();
  const unitB = randomUUID();
  const ids = { all: randomUUID(), unitB: randomUUID(), hr: randomUUID(), hidden: randomUUID() };
  // Bắt đầu bằng chữ: 8 ký tự hex toàn số (khoảng 2% số lần) sẽ bị G1 che như dãy số dài, câu hỏi mất tag và test chập chờn.
  const tag = `t${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    registerProvider({ id: 'fake', name: 'Fake', dataRegion: '-', defaultBaseUrl: null, adapter: llm });
    const files = new Map<string, Buffer>();
    const embedder = new HashEmbedder(256);
    const indexer = new Indexer(pool, { read: async (k) => files.get(k)! }, embedder);
    const docs: Array<[string, string, object, boolean]> = [
      [ids.all, `Điều 5. Nghỉ việc riêng ${tag}|Người lao động kết hôn được nghỉ 3 ngày hưởng nguyên lương. Hotline HR 1900 1234 56.`, { all: true, departmentIds: [], roles: [] }, false],
      [ids.unitB, `Điều 2. Phụ cấp riêng phòng B ${tag}|Nhân viên phòng B kết hôn được thưởng thêm 2 ngày nghỉ.`, { all: false, departmentIds: [unitB], roles: [] }, false],
      [ids.hr, `Điều 9. Quy trình nội bộ HR ${tag}|HR xử lý hồ sơ kết hôn trong 2 ngày làm việc.`, { all: false, departmentIds: [], roles: ['HR'] }, false],
      [ids.hidden, `Điều 1. Bản cũ ${tag}|Kết hôn được nghỉ 1 ngày (bản cũ đã ẩn).`, { all: true, departmentIds: [], roles: [] }, true],
    ];
    // Tham số thứ hai là id event (id outbox, tăng dần) làm mốc thứ tự.
    let seq = Date.now() * 1000;
    for (const [id, text, scope, hidden] of docs) {
      const [h, body] = text.split('|');
      files.set(id, await makeDocx([{ text: h }, { text: body }]));
      await indexer.published({
        documentId: id, versionId: randomUUID(), versionNo: 1, objectKey: id, contentType: DOCX,
        title: `Quy chế ${tag}`, type: 'POLICY', scope: scope as any, hidden, occurredAt: '',
      }, String(++seq));
    }
    answerer = new Answerer(new Retriever(pool, embedder), configs, 1000);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM assistant.document WHERE id = ANY($1)', [Object.values(ids)]);
    await pool.end();
  });

  beforeEach(() => {
    llm.calls.length = 0;
    llm.reply = (ps) => `Theo quy định, kết hôn được nghỉ [${ps[0].n}].`;
    configs.config = { provider: 'fake', model: 'm', apiKey: 'k', baseUrl: null, enabled: true };
  });

  const docsSent = () => new Set(llm.calls.flatMap((c) => c.passages.map((p) => p.documentId)));
  const ask = (q: string, scope = { unitIds: [unitA], roles: ['EMPLOYEE'] }) => answerer.answer(`${q} ${tag}`, scope);

  it('chỉ gửi LLM đoạn trong phạm vi: không đơn vị khác, không vai trò khác, không tài liệu ẩn (AC-6.3.2, 6.3.7)', async () => {
    const r = await ask('kết hôn được nghỉ mấy ngày');
    expect(r.fallback).toBe(false);
    expect(r.citations[0].documentId).toBe(ids.all);
    expect([...docsSent()]).toEqual([ids.all]);
  });

  it('đơn vị B và vai trò HR thấy thêm tài liệu của mình', async () => {
    await ask('kết hôn được nghỉ mấy ngày', { unitIds: [unitA, unitB], roles: ['EMPLOYEE', 'HR'] });
    expect(docsSent()).toEqual(new Set([ids.all, ids.unitB, ids.hr]));
  });

  it('không có đoạn liên quan thì "không tìm thấy", không gọi LLM (A1)', async () => {
    const r = await answerer.answer('giá vàng hôm nay bao nhiêu', { unitIds: [unitA], roles: ['EMPLOYEE'] });
    expect(r).toMatchObject({ fallback: false, citations: [] });
    expect(r.answer).toMatch(/không tìm thấy/);
    expect(llm.calls).toHaveLength(0);
  });

  it('LLM lỗi, quá giờ, tắt, chưa cấu hình: fallback kèm danh sách tài liệu trong phạm vi (AC-6.3.4)', async () => {
    llm.reply = () => new LlmError('timeout', 'x');
    let r = await ask('kết hôn được nghỉ mấy ngày');
    expect(r).toMatchObject({ fallback: true, answer: FALLBACK_ANSWER, documents: [{ documentId: ids.all, title: `Quy chế ${tag}` }] });
    configs.config = { ...configs.config!, enabled: false };
    r = await ask('kết hôn được nghỉ mấy ngày');
    expect(r.fallback).toBe(true);
    configs.config = null;
    expect((await ask('kết hôn được nghỉ mấy ngày')).fallback).toBe(true);
  });

  it('trích dẫn không hợp lệ thì fallback (A5); model báo không tìm thấy thì câu chuẩn', async () => {
    llm.reply = () => 'Được nghỉ 3 ngày [9].';
    expect((await ask('kết hôn được nghỉ mấy ngày')).fallback).toBe(true);
    llm.reply = () => 'Mình không tìm thấy nội dung này.';
    const r = await ask('kết hôn được nghỉ mấy ngày');
    expect(r).toMatchObject({ fallback: false, citations: [] });
  });

  it('G1: câu gửi LLM đã che dữ liệu cá nhân, masked = true (AC-6.3.8)', async () => {
    const r = await ask('tôi số 0912345678 kết hôn được nghỉ mấy ngày');
    expect(r.masked).toBe(true);
    expect(llm.calls[0].question).not.toContain('0912345678');
    expect(llm.calls[0].question).toContain('[đã ẩn]');
  });

  it('G2: số lạ trong câu trả lời bị che, hotline có trong tài liệu giữ; lộ system prompt thì fallback', async () => {
    llm.reply = (ps) => `Gọi hotline 1900123456 hoặc anh A 0987654321 [${ps[0].n}].`;
    const r = await ask('kết hôn được nghỉ mấy ngày');
    expect(r.answer).toBe('Gọi hotline 1900123456 hoặc anh A [đã ẩn] [1].');
    llm.reply = (ps) => `${SYSTEM_PROMPT.slice(0, 80)} [${ps[0].n}]`;
    expect((await ask('kết hôn được nghỉ mấy ngày')).fallback).toBe(true);
  });
});
