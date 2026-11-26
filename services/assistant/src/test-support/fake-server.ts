import { createServer, Server } from 'http';
import { AddressInfo } from 'net';

/** Máy chủ HTTP giả cho test adapter LLM: ghi lại request (đường dẫn, header, body), trả theo `reply`. */
export function fakeServer(reply: (path: string, body: any) => { status: number; body: unknown; delayMs?: number }) {
  const calls: Array<{ path: string; auth: string; headers: Record<string, unknown>; body: any }> = [];
  const server: Server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : undefined;
      calls.push({ path: req.url!, auth: String(req.headers.authorization), headers: req.headers, body });
      const r = reply(req.url!, body);
      setTimeout(() => {
        res.writeHead(r.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(r.body));
      }, r.delayMs ?? 0);
    });
  });
  return {
    calls,
    /** Trả URL gốc, ví dụ `http://127.0.0.1:1234` + `suffix`. */
    start: (suffix = '/v1') =>
      new Promise<string>((ok) => server.listen(0, '127.0.0.1', () => ok(`http://127.0.0.1:${(server.address() as AddressInfo).port}${suffix}`))),
    stop: () => new Promise<void>((ok) => server.close(() => ok())),
  };
}
