import { IncomingMessage } from 'http';
import { checkToken, parseAnswerRequest, traceIdOf } from './route';

const req = (headers: Record<string, string>) => ({ headers }) as unknown as IncomingMessage;
const U = '11111111-2222-3333-4444-555555555555';

describe('POST /internal/answers: kiểm đầu vào', () => {
  it('token nội bộ', () => {
    expect(checkToken(req({ authorization: 'Bearer abcdefghijklmnop' }), 'abcdefghijklmnop')).toBe(true);
    expect(checkToken(req({ authorization: 'Bearer abcdefghijklmnoX' }), 'abcdefghijklmnop')).toBe(false);
    expect(checkToken(req({}), 'abcdefghijklmnop')).toBe(false);
  });

  it('câu hỏi 1–500 ký tự, phạm vi đúng kiểu', () => {
    expect(parseAnswerRequest({ question: '  nghỉ cưới? ', scope: { unitIds: [U], roles: ['EMPLOYEE'] } })).toEqual({
      question: 'nghỉ cưới?',
      scope: { unitIds: [U], roles: ['EMPLOYEE'] },
    });
    expect(() => parseAnswerRequest({ question: ' ', scope: { unitIds: [], roles: [] } })).toThrow(/question/);
    expect(() => parseAnswerRequest({ question: 'x'.repeat(501), scope: { unitIds: [], roles: [] } })).toThrow(/question/);
    expect(() => parseAnswerRequest({ question: 'q', scope: { unitIds: ["x' OR 1=1"], roles: [] } })).toThrow(/uuid/);
    expect(() => parseAnswerRequest({ question: 'q' })).toThrow(/scope/);
  });

  it('trace id từ traceparent', () => {
    expect(traceIdOf(req({ traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' }))).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(traceIdOf(req({ traceparent: 'rác' }))).toBeUndefined();
  });
});
