import { timingSafeEqual } from 'crypto';
import { IncomingMessage } from 'http';
import { Answerer } from './answerer';

/**
 * `POST /internal/answers` (UC6 spec 9.2): chỉ API gọi, qua mạng nội bộ, header `Authorization: Bearer <ASSISTANT_INTERNAL_TOKEN>`.
 * Phạm vi do API tính; service không tự suy ra phạm vi.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_QUESTION = 500;

const bad = (message: string) => Object.assign(new Error(message), { status: 400 });

export function checkToken(req: IncomingMessage, token: string): boolean {
  const got = Buffer.from(String(req.headers.authorization ?? ''));
  const want = Buffer.from(`Bearer ${token}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Lấy trace id từ header W3C `traceparent` (00-<trace-id>-<span-id>-<flags>) để nối log với API. */
export function traceIdOf(req: IncomingMessage): string | undefined {
  const m = /^[\da-f]{2}-([\da-f]{32})-[\da-f]{16}-[\da-f]{2}$/.exec(String(req.headers.traceparent ?? ''));
  return m?.[1];
}

export function parseAnswerRequest(body: unknown): { question: string; scope: { unitIds: string[]; roles: string[] } } {
  const b = body as { question?: unknown; scope?: { unitIds?: unknown; roles?: unknown } } | undefined;
  const question = typeof b?.question === 'string' ? b.question.trim() : '';
  if (!question || question.length > MAX_QUESTION) throw bad(`question phải có 1–${MAX_QUESTION} ký tự`);
  const unitIds = b?.scope?.unitIds;
  const roles = b?.scope?.roles;
  if (!Array.isArray(unitIds) || unitIds.length > 100 || unitIds.some((u) => typeof u !== 'string' || !UUID.test(u))) throw bad('scope.unitIds phải là mảng uuid');
  if (!Array.isArray(roles) || roles.length > 20 || roles.some((r) => typeof r !== 'string' || r.length > 30)) throw bad('scope.roles phải là mảng chuỗi');
  return { question, scope: { unitIds, roles } };
}

export function answerRoute(answerer: Answerer, token: string) {
  return async (req: IncomingMessage, body: unknown) => {
    if (!checkToken(req, token)) return { status: 401, body: { code: 'UNAUTHENTICATED', message: 'Thiếu hoặc sai token nội bộ' } };
    const { question, scope } = parseAnswerRequest(body);
    return { status: 200, body: await answerer.answer(question, scope, traceIdOf(req)) };
  };
}
