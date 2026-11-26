import { context, SpanKind, trace } from '@opentelemetry/api';
import { node } from '@opentelemetry/sdk-node';
import { writeOutbox } from '../messaging/outbox';
import { OutboxPublisher } from '../modules/leave/outbox/outbox-publisher';
import { contextFromTraceparent, currentTraceparent, inSpan, tracer } from './tracing';

/** ADR-15 bước 4: traceparent đi từ request → outbox → publisher → message, cùng một trace id. */
describe('truy vết qua outbox (ADR-15 bước 4)', () => {
  it('chưa bật tracing: không có traceparent, outbox ghi NULL', async () => {
    expect(currentTraceparent()).toBeNull();
    const m = { query: jest.fn().mockResolvedValue([]) };
    await writeOutbox(m as never, 'LeaveApproved', 'r-1', { requestId: 'r-1' });
    expect(m.query.mock.calls[0][1][3]).toBeNull();
  });

  describe('đã bật tracing', () => {
    const exporter = new node.InMemorySpanExporter();
    let provider: InstanceType<typeof node.NodeTracerProvider>;
    beforeAll(() => {
      provider = new node.NodeTracerProvider({ spanProcessors: [new node.SimpleSpanProcessor(exporter)] });
      provider.register();
    });
    afterEach(() => exporter.reset());
    afterAll(() => provider.shutdown());

    it('writeOutbox ghi traceparent của request đang chạy', async () => {
      const m = { query: jest.fn().mockResolvedValue([]) };
      let traceId = '';
      await tracer().startActiveSpan('POST /leave-requests/:id/approve', async (span) => {
        traceId = span.spanContext().traceId;
        await writeOutbox(m as never, 'LeaveApproved', 'r-1', { requestId: 'r-1' });
        span.end();
      });
      const tp = m.query.mock.calls[0][1][3] as string;
      expect(tp).toMatch(new RegExp(`^00-${traceId}-[0-9a-f]{16}-01$`));
    });

    it('publisher tạo span PRODUCER con của request, message mang traceparent cùng trace', async () => {
      const parent = tracer().startSpan('request');
      const parentCtx = trace.setSpan(context.active(), parent);
      const traceContext = context.with(parentCtx, () => currentTraceparent());
      parent.end();

      const row = { id: '7', eventType: 'LeaveApproved', payload: { requestId: 'r', employeeId: 'e' }, createdAt: new Date(), attempts: 0, traceContext };
      const qb = { where: () => qb, orderBy: () => qb, limit: () => qb, setLock: () => qb, setOnLocked: () => qb, getMany: async () => [row] };
      const m = { getRepository: () => ({ createQueryBuilder: () => qb }), update: jest.fn() };
      const ds = { transaction: (fn: (m: unknown) => unknown) => fn(m) };
      const bus = { publish: jest.fn().mockResolvedValue(undefined), close: jest.fn() };
      const recipients = { attach: async (_t: string, p: unknown) => ({ ...(p as object), mail: [] }) };
      const pub = new OutboxPublisher({ queue: { driver: 'rabbitmq' } } as never, ds as never, recipients as never, bus);

      expect(await pub.tick()).toBe(1);
      const sent = bus.publish.mock.calls[0][0];
      const span = exporter.getFinishedSpans().find((s) => s.name === 'publish LeaveApproved')!;
      expect(span.kind).toBe(SpanKind.PRODUCER);
      expect(span.spanContext().traceId).toBe(parent.spanContext().traceId);
      expect(span.parentSpanContext?.spanId).toBe(parent.spanContext().spanId);
      expect(sent.traceparent).toBe(`00-${span.spanContext().traceId}-${span.spanContext().spanId}-01`);
    });

    it('consumer nối span xử lý vào trace của message; lỗi thì span có status ERROR', async () => {
      const producer = tracer().startSpan('publish X');
      const tp = `00-${producer.spanContext().traceId}-${producer.spanContext().spanId}-01`;
      producer.end();
      await expect(
        inSpan('process X', { kind: SpanKind.CONSUMER, parent: contextFromTraceparent(tp) }, async () => {
          throw new Error('IdP lỗi');
        }),
      ).rejects.toThrow('IdP lỗi');
      const span = exporter.getFinishedSpans().find((s) => s.name === 'process X')!;
      expect(span.spanContext().traceId).toBe(producer.spanContext().traceId);
      expect(span.status.code).toBe(2);
    });
  });
});
