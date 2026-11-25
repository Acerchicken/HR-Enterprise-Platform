import { JsonLogger } from './json-logger';
import { requestContext } from './request-context';

describe('JsonLogger (NFR-8.1)', () => {
  const setup = () => {
    const lines: string[] = [];
    const logger = new JsonLogger('api', 'abc123', (l) => lines.push(l));
    return { logger, out: () => lines.map((l) => JSON.parse(l)) };
  };

  it('mỗi log là một dòng JSON có level, context, version', () => {
    const { logger, out } = setup();
    logger.log('Khởi động', 'Bootstrap');
    expect(out()[0]).toMatchObject({ level: 'info', service: 'api', version: 'abc123', context: 'Bootstrap', msg: 'Khởi động' });
    expect(out()[0].traceId).toBeUndefined();
  });

  it('log trong request có traceId của request (NFR-6.4)', () => {
    const { logger, out } = setup();
    requestContext.run({ traceId: 't-1', ip: null }, () => logger.warn('chậm', 'LeaveService'));
    expect(out()[0]).toMatchObject({ level: 'warn', traceId: 't-1', context: 'LeaveService' });
  });

  it('error giữ stack, nhận cả Error', () => {
    const { logger, out } = setup();
    logger.error('hỏng', 'Error: hỏng\n    at x', 'ApiErrorFilter');
    logger.error(new Error('boom'));
    expect(out()[0]).toMatchObject({ level: 'error', msg: 'hỏng', stack: 'Error: hỏng\n    at x', context: 'ApiErrorFilter' });
    expect(out()[1].msg).toBe('boom');
    expect(out()[1].stack).toContain('boom');
  });

  it('metric theo CloudWatch Embedded Metric Format (NFR-8.2)', () => {
    const { logger, out } = setup();
    logger.metric('OutboxPending', 3);
    const m = out()[0];
    expect(m.OutboxPending).toBe(3);
    expect(m.Service).toBe('api');
    expect(m._aws.CloudWatchMetrics[0]).toEqual({ Namespace: 'HRHelper', Dimensions: [['Service']], Metrics: [{ Name: 'OutboxPending', Unit: 'Count' }] });
  });

  it('access log không ghi query string', () => {
    const { logger, out } = setup();
    logger.access({ method: 'GET', path: '/api/v1/employees', status: 200, durationMs: 12.3, traceId: 't-2' });
    expect(out()[0]).toMatchObject({ context: 'HTTP', msg: 'request', status: 200, traceId: 't-2' });
  });
});
