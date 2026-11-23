import { fakeServer } from '../test-support/fake-server';
import { GoogleProvider } from './google';

const passage = { n: 1, chunkId: '1', documentId: 'd', versionNo: 1, title: 'Quy chế', section: 'Điều 5', content: 'Kết hôn nghỉ 3 ngày' };

describe('GoogleProvider', () => {
  let mode: 'ok' | 'badkey' | 'safety' | 'thought' = 'ok';
  const srv = fakeServer((path) => {
    if (mode === 'badkey') {
      return { status: 400, body: { error: { code: 400, message: 'API key not valid AIza-secret', status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } } };
    }
    if (path.startsWith('/v1beta/models?')) {
      if (!path.includes('pageToken')) {
        return {
          status: 200,
          body: {
            models: [
              { name: 'models/gemini-pro', displayName: 'Gemini Pro', supportedGenerationMethods: ['generateContent'] },
              { name: 'models/text-embedding', displayName: 'Embedding', supportedGenerationMethods: ['embedContent'] },
            ],
            nextPageToken: 'p2',
          },
        };
      }
      return { status: 200, body: { models: [{ name: 'models/gemini-flash', displayName: 'Gemini Flash', supportedGenerationMethods: ['generateContent'] }] } };
    }
    if (mode === 'safety') return { status: 200, body: { candidates: [{ finishReason: 'SAFETY', content: { parts: [] } }] } };
    const parts = [{ text: 'Nghỉ 3 ngày [1].' }];
    if (mode === 'thought') parts.unshift({ text: 'suy nghĩ…', thought: true } as any);
    return { status: 200, body: { candidates: [{ finishReason: 'STOP', content: { parts } }], usageMetadata: { promptTokenCount: 90, candidatesTokenCount: 7 } } };
  });
  let url: string;

  beforeAll(async () => {
    url = await srv.start('/v1beta');
  });
  afterAll(() => srv.stop());
  beforeEach(() => {
    mode = 'ok';
    srv.calls.length = 0;
  });

  const opts = () => ({ model: 'gemini-flash', apiKey: 'AIza-secret', baseUrl: url, timeoutMs: 2000 });

  it('dựng request generateContent: khóa ở header, system prompt, đoạn bọc <doc>; bỏ phần suy nghĩ', async () => {
    mode = 'thought';
    const r = await new GoogleProvider().answer({ system: 'SYS', question: 'nghỉ cưới?', passages: [passage] }, opts());
    const call = srv.calls[0];
    expect(call.path).toBe('/v1beta/models/gemini-flash:generateContent');
    expect(call.path).not.toContain('AIza');
    expect(call.headers['x-goog-api-key']).toBe('AIza-secret');
    expect(call.body.systemInstruction).toEqual({ parts: [{ text: 'SYS' }] });
    expect(call.body.contents[0].parts[0].text).toContain('<doc n="1" title="Quy chế – Điều 5">');
    expect(r).toEqual({ text: 'Nghỉ 3 ngày [1].', citedPassages: null, usage: { inputTokens: 90, outputTokens: 7 } });
  });

  it('khóa sai (400 API_KEY_INVALID) thì auth, thông báo không chứa khóa; SAFETY thì refused', async () => {
    mode = 'badkey';
    const e = await new GoogleProvider().testConnection(opts()).catch((x) => x);
    expect(e.kind).toBe('auth');
    expect(e.message).not.toContain('AIza-secret');
    mode = 'safety';
    await expect(new GoogleProvider().answer({ system: 'S', question: 'q', passages: [passage] }, opts())).rejects.toMatchObject({ kind: 'refused' });
  });

  it('tên model lạ bị từ chối trước khi gọi', async () => {
    await expect(new GoogleProvider().testConnection({ ...opts(), model: '../x?y' })).rejects.toMatchObject({ kind: 'bad_request' });
    expect(srv.calls).toHaveLength(0);
  });

  it('listModels đọc nhiều trang, chỉ giữ model sinh văn bản, sắp xếp', async () => {
    expect(await new GoogleProvider().listModels({ apiKey: 'k', baseUrl: url, timeoutMs: 2000 })).toEqual([
      { id: 'gemini-flash', name: 'Gemini Flash' },
      { id: 'gemini-pro', name: 'Gemini Pro' },
    ]);
    expect(srv.calls[1].path).toContain('pageToken=p2');
  });
});
