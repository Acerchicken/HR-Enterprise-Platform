import { fakeServer } from '../test-support/fake-server';
import { OpenAiCompatibleProvider } from './openai-compatible';
import { LlmError } from './provider';

const passage = { n: 1, chunkId: '1', documentId: 'd', versionNo: 1, title: 'Quy chế', section: 'Điều 5', content: 'Kết hôn nghỉ 3 ngày' };

describe('OpenAiCompatibleProvider', () => {
  let srv: ReturnType<typeof fakeServer>;
  let url: string;
  let mode: 'ok' | 'slow' | 'auth' | 'empty' = 'ok';

  beforeAll(async () => {
    srv = fakeServer((path) => {
      if (path.endsWith('/models')) return { status: mode === 'auth' ? 401 : 200, body: { data: [{ id: 'deepseek-reasoner' }, { id: 'deepseek-chat' }] } };
      if (mode === 'auth') return { status: 401, body: { error: { message: 'bad key sk-secret' } } };
      if (mode === 'empty') return { status: 200, body: { choices: [{ message: { content: '' }, finish_reason: 'stop' }] } };
      return {
        status: 200,
        delayMs: mode === 'slow' ? 500 : 0,
        body: { choices: [{ message: { content: 'Nghỉ 3 ngày [1].' }, finish_reason: 'stop' }], usage: { prompt_tokens: 120, completion_tokens: 8 } },
      };
    });
    url = await srv.start();
  });
  afterAll(() => srv.stop());
  beforeEach(() => {
    mode = 'ok';
    srv.calls.length = 0;
  });

  const provider = () => new OpenAiCompatibleProvider('http://unused');
  const opts = () => ({ model: 'deepseek-chat', apiKey: 'sk-secret', baseUrl: url, timeoutMs: 200 });

  it('dựng request: system prompt, đoạn bọc <doc>, khóa ở header; đọc câu trả lời và token', async () => {
    const r = await provider().answer({ system: 'SYS', question: 'nghỉ cưới?', passages: [passage] }, opts());
    expect(r).toEqual({ text: 'Nghỉ 3 ngày [1].', citedPassages: null, usage: { inputTokens: 120, outputTokens: 8 } });
    const call = srv.calls[0];
    expect(call.path).toBe('/v1/chat/completions');
    expect(call.auth).toBe('Bearer sk-secret');
    expect(call.body.model).toBe('deepseek-chat');
    expect(call.body.max_tokens).toBe(1024);
    expect(call.body.messages[0]).toEqual({ role: 'system', content: 'SYS' });
    expect(call.body.messages[1].content).toContain('<doc n="1" title="Quy chế – Điều 5">');
    expect(call.body.messages[1].content).toContain('Câu hỏi của nhân viên: nghỉ cưới?');
  });

  it('quá thời gian thì LlmError timeout, không thử lại', async () => {
    mode = 'slow';
    await expect(provider().answer({ system: 'S', question: 'q', passages: [passage] }, opts())).rejects.toMatchObject({ kind: 'timeout' });
    expect(srv.calls).toHaveLength(1);
  });

  it('401 thì LlmError auth, thông báo không chứa khóa', async () => {
    mode = 'auth';
    const e: LlmError = await provider()
      .answer({ system: 'S', question: 'q', passages: [passage] }, opts())
      .catch((x) => x);
    expect(e.kind).toBe('auth');
    expect(e.message).not.toContain('sk-secret');
  });

  it('câu trả lời rỗng thì refused', async () => {
    mode = 'empty';
    await expect(provider().answer({ system: 'S', question: 'q', passages: [passage] }, opts())).rejects.toMatchObject({ kind: 'refused' });
  });

  it('listModels đọc danh sách từ API, sắp xếp; khóa sai thì auth', async () => {
    expect(await provider().listModels({ apiKey: 'k', baseUrl: url, timeoutMs: 500 })).toEqual([
      { id: 'deepseek-chat', name: 'deepseek-chat' },
      { id: 'deepseek-reasoner', name: 'deepseek-reasoner' },
    ]);
    mode = 'auth';
    await expect(provider().listModels({ apiKey: 'k', baseUrl: url, timeoutMs: 500 })).rejects.toMatchObject({ kind: 'auth' });
  });
});
