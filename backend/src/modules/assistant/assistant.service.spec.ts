import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { AppConfig } from '../../config/config';
import { DocumentService } from '../document/document.service';
import { AuthUser } from '../identity/roles';
import { AssistantService, NOT_FOUND_ANSWER, traceparentOf, UNAVAILABLE_ANSWER } from './assistant.service';

const UNIT = '11111111-2222-3333-4444-555555555555';
const user = { employeeId: 'e1', roles: ['EMPLOYEE'] } as unknown as AuthUser;

describe('AssistantService (BFF trợ lý, UC6)', () => {
  let server: Server;
  let base: string;
  const calls: Array<{ auth: string; traceparent: string; body: any }> = [];
  let reply: { status: number; body: unknown; delayMs?: number } = { status: 200, body: {} };

  beforeAll(async () => {
    server = createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        calls.push({ auth: String(req.headers.authorization), traceparent: String(req.headers.traceparent), body: JSON.parse(raw) });
        setTimeout(() => {
          res.writeHead(reply.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(reply.body));
        }, reply.delayMs ?? 0);
      });
    });
    await new Promise<void>((ok) => server.listen(0, '127.0.0.1', () => ok()));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((ok) => server.close(() => ok())));
  beforeEach(() => (calls.length = 0));

  const make = (active = true, url: string | null = base) => {
    const docs = { viewerOf: async () => ({ active, departmentChain: active ? [UNIT] : [], roles: active ? ['EMPLOYEE'] : [] }) } as unknown as DocumentService;
    const cfg = { assistant: { url, internalToken: 'token-token-token-1', timeoutMs: 200 } } as AppConfig;
    return new AssistantService(cfg, docs);
  };

  it('không có hồ sơ đang làm việc: "không tìm thấy", không gọi assistant service (DR-02)', async () => {
    expect(await make(false).ask(user, 'nghỉ cưới?', null)).toEqual({ answer: NOT_FOUND_ANSWER, citations: [], fallback: false, masked: false });
    expect(calls).toHaveLength(0);
  });

  it('gửi câu hỏi, phạm vi tính ở API, token nội bộ, traceparent theo traceId', async () => {
    reply = { status: 200, body: { answer: 'Nghỉ 3 ngày [1].', citations: [{ n: 1 }], fallback: false, masked: false } };
    const r = await make().ask(user, 'nghỉ cưới?', '4bf92f35-77b3-4da6-a3ce-929d0e0e4736');
    expect(r).toEqual({ answer: 'Nghỉ 3 ngày [1].', citations: [{ n: 1 }], fallback: false, masked: false });
    expect(calls[0].auth).toBe('Bearer token-token-token-1');
    expect(calls[0].body).toEqual({ question: 'nghỉ cưới?', scope: { unitIds: [UNIT], roles: ['EMPLOYEE'] } });
    expect(calls[0].traceparent).toMatch(/^00-4bf92f3577b34da6a3ce929d0e0e4736-[0-9a-f]{16}-01$/);
  });

  it('service chưa cấu hình, quá giờ, lỗi HTTP, không kết nối được: fallback, không 5xx (E5)', async () => {
    const unavailable = { answer: UNAVAILABLE_ANSWER, citations: [], fallback: true, masked: false, documents: [] };
    expect(await make(true, null).ask(user, 'q', null)).toEqual(unavailable);
    reply = { status: 200, body: {}, delayMs: 400 };
    expect(await make().ask(user, 'q', null)).toEqual(unavailable);
    reply = { status: 500, body: {} };
    expect(await make().ask(user, 'q', null)).toEqual(unavailable);
    expect(await make(true, 'http://127.0.0.1:1').ask(user, 'q', null)).toEqual(unavailable);
  });

  it('traceparent hợp lệ cả khi traceId không phải hex', () => {
    expect(traceparentOf('abc')).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });
});
