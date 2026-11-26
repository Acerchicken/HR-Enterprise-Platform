import { createServer, Server } from 'http';
import { errorText, log } from './log';

/**
 * HTTP nội bộ chỉ có `GET /health` (healthcheck của docker compose, ECS); service không nhận request nghiệp vụ nào.
 * Trả 503 khi không truy vấn được PostgreSQL (không chống trùng được thì không nên nhận event).
 */
export function createHealthServer(check: () => Promise<void>): Server {
  return createServer((req, res) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    if (req.method !== 'GET' || (req.url ?? '').split('?')[0] !== '/health') return send(404, { code: 'NOT_FOUND' });
    check()
      .then(() => send(200, { status: 'ok', service: 'notification', version: process.env.APP_VERSION || 'dev' }))
      .catch((e) => {
        log.warn('Healthcheck lỗi', { error: errorText(e) });
        send(503, { status: 'error', service: 'notification' });
      });
  });
}
