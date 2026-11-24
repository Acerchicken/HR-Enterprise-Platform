import { fakeServer } from '../test-support/fake-server';
import { AnthropicProvider, ANTHROPIC_SYSTEM_NOTE } from './anthropic';
import { LlmError } from './provider';

const passages = [
  { n: 1, chunkId: '1', documentId: 'd1', versionNo: 2, title: 'Quy chế', section: 'Điều 5', content: 'Kết hôn nghỉ 3 ngày' },
  { n: 2, chunkId: '2', documentId: 'd1', versionNo: 2, title: 'Quy chế', section: 'Điều 6', content: 'Phép năm chuyển sang năm sau' },
];

const message = (content: unknown[], extra: Record<string, unknown> = {}) => ({
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: 'claude-x',
  content,
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: { input_tokens: 300, output_tokens: 20 },
  ...extra,
});

const loc = (i: number) => ({ type: 'search_result_location', search_result_index: i, source: 's', title: 't', cited_text: 'x', start_block_index: 0, end_block_index: 1 });

describe('AnthropicProvider', () => {
  let mode: 'ok' | 'auth' | 'refusal' | 'slow' | 'overloaded' = 'ok';
  const srv = fakeServer((path) => {
    if (mode === 'auth') return { status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key sk-ant-secret' } } };
    if (mode === 'overloaded') return { status: 529, body: { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } } };
    if (path.startsWith('/v1/models')) {
      return {
        status: 200,
        body: { data: [{ type: 'model', id: 'claude-b', display_name: 'Claude B', created_at: '2026-01-01T00:00:00Z' }, { type: 'model', id: 'claude-a', display_name: 'Claude A', created_at: '2026-01-01T00:00:00Z' }], has_more: false, first_id: 'claude-b', last_id: 'claude-a' },
      };
    }
    if (mode === 'refusal') return { status: 200, body: message([], { stop_reason: 'refusal', stop_details: { type: 'refusal', category: null, explanation: null } }) };
    return {
      status: 200,
      delayMs: mode === 'slow' ? 500 : 0,
      body: message([
        { type: 'text', text: 'Khi kết hôn bạn được nghỉ 3 ngày [7]', citations: [loc(0)] },
        { type: 'text', text: ', còn phép năm thừa được chuyển sang năm sau.', citations: [loc(1), loc(9)] },
        { type: 'text', text: ' Hỏi HR nếu cần.', citations: null },
      ]),
    };
  });
  let url: string;

  beforeAll(async () => {
    url = await srv.start('');
  });
  afterAll(() => srv.stop());
  beforeEach(() => {
    mode = 'ok';
    srv.calls.length = 0;
  });

  const opts = (timeoutMs = 2000) => ({ model: 'claude-x', apiKey: 'sk-ant-secret', baseUrl: url, timeoutMs });

  it('gửi đoạn dưới dạng search_result bật citations, không gửi temperature; đọc trích dẫn có cấu trúc', async () => {
    const r = await new AnthropicProvider().answer({ system: 'SYS', question: 'nghỉ cưới?', passages }, opts());
    const call = srv.calls[0];
    expect(call.path).toBe('/v1/messages');
    // SDK 1.x gửi khóa ở `Authorization: Bearer` (hoặc `x-api-key` ở bản cũ).
    expect([call.auth, `Bearer ${call.headers['x-api-key']}`]).toContain('Bearer sk-ant-secret');
    expect(call.body.system).toBe(`SYS\n${ANTHROPIC_SYSTEM_NOTE}`);
    expect(call.body).not.toHaveProperty('temperature');
    const content = call.body.messages[0].content;
    expect(content[0]).toEqual({
      type: 'search_result',
      source: 'hrhelper:document/d1/v2#1',
      title: 'Quy chế – Điều 5',
      content: [{ type: 'text', text: 'Kết hôn nghỉ 3 ngày' }],
      citations: { enabled: true },
    });
    expect(content[2]).toEqual({ type: 'text', text: 'Câu hỏi của nhân viên: nghỉ cưới?' });
    // [7] model tự viết bị bỏ; số đoạn gắn theo trích dẫn; chỉ số ngoài danh sách (9) bị bỏ.
    expect(r).toEqual({
      text: 'Khi kết hôn bạn được nghỉ 3 ngày[1], còn phép năm thừa được chuyển sang năm sau.[2] Hỏi HR nếu cần.',
      citedPassages: [1, 2],
      usage: { inputTokens: 300, outputTokens: 20 },
    });
  });

  it('stop_reason refusal thì LlmError refused', async () => {
    mode = 'refusal';
    await expect(new AnthropicProvider().answer({ system: 'S', question: 'q', passages }, opts())).rejects.toMatchObject({ kind: 'refused' });
  });

  it('401 thì auth, thông báo không chứa khóa; 529 thì unavailable; quá giờ thì timeout; không thử lại', async () => {
    mode = 'auth';
    const e = await new AnthropicProvider().answer({ system: 'S', question: 'q', passages }, opts()).catch((x) => x);
    expect(e).toBeInstanceOf(LlmError);
    expect(e.kind).toBe('auth');
    expect(e.message).not.toContain('sk-ant-secret');
    expect(srv.calls).toHaveLength(1);

    mode = 'overloaded';
    await expect(new AnthropicProvider().testConnection(opts())).rejects.toMatchObject({ kind: 'unavailable' });

    mode = 'slow';
    await expect(new AnthropicProvider().answer({ system: 'S', question: 'q', passages }, opts(100))).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('listModels đọc tên hiển thị; khóa sai thì auth', async () => {
    expect(await new AnthropicProvider().listModels({ apiKey: 'k', baseUrl: url, timeoutMs: 2000 })).toEqual([
      { id: 'claude-b', name: 'Claude B' },
      { id: 'claude-a', name: 'Claude A' },
    ]);
    mode = 'auth';
    await expect(new AnthropicProvider().listModels({ apiKey: 'k', baseUrl: url, timeoutMs: 2000 })).rejects.toMatchObject({ kind: 'auth' });
  });
});
