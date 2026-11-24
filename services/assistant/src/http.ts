import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { errorText, log } from './log';

/**
 * HTTP nội bộ của assistant service (chỉ mạng nội bộ, ADR-15): `/health`, `POST /internal/answers`; cấu hình thêm ở
 * `feat/assistant-config`. Lỗi 500 không trả chi tiết (có thể chứa nội dung).
 */
export type Route = (req: IncomingMessage, body: unknown) => Promise<{ status: number; body: unknown }>;

export function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

const MAX_BODY = 64 * 1024;

async function readBody(req: IncomingMessage): Promise<unknown> {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw Object.assign(new Error('Body quá lớn'), { status: 413 });
    parts.push(chunk as Buffer);
  }
  if (!size) return undefined;
  try {
    return JSON.parse(Buffer.concat(parts).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Body không phải JSON'), { status: 400 });
  }
}

export function createHttpServer(routes: Record<string, Route>): Server {
  return createServer((req, res) => {
    const key = `${req.method} ${(req.url ?? '').split('?')[0]}`;
    const route = routes[key];
    if (!route) return json(res, 404, { code: 'NOT_FOUND', message: 'Không có đường dẫn này' });
    readBody(req)
      .then((body) => route(req, body))
      .then((r) => json(res, r.status, r.body))
      .catch((e) => {
        const status = typeof e?.status === 'number' ? e.status : 500;
        if (status === 500) log.error('Lỗi xử lý request', { route: key, error: errorText(e) });
        json(res, status, { code: status === 500 ? 'INTERNAL' : 'BAD_REQUEST', message: status === 500 ? 'Lỗi hệ thống' : String(e.message) });
      });
  });
}
