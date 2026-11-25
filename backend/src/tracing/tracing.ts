import { Context, context, propagation, ROOT_CONTEXT, Span, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';

/**
 * Truy vết phân tán (ADR-15 bước 4, NFR-8.x): OpenTelemetry, chuẩn W3C Trace Context (`traceparent`).
 * - Bật khi có `OTEL_EXPORTER_OTLP_ENDPOINT` (local: Jaeger, xem docker-compose profile `observability`); không đặt thì mọi hàm
 *   ở đây không làm gì (API của OpenTelemetry là no-op), không tốn chi phí.
 * - Một trace đi từ request HTTP → ghi outbox (cột `trace_context`) → publisher → queue (header `traceparent`) → notification
 *   service hoặc assistant service hoặc worker identity-sync.
 */
export const TRACER = 'hr-platform';
export const tracer = () => trace.getTracer(TRACER);

/** `traceparent` của span đang chạy, để ghi kèm event vào outbox; null khi chưa bật tracing hoặc không có span. */
export function currentTraceparent(): string | null {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  return carrier.traceparent ?? null;
}

/** Context cha dựng lại từ `traceparent` (lấy từ outbox hoặc header message); không có thì là gốc mới. */
export function contextFromTraceparent(traceparent: string | null | undefined): Context {
  if (!traceparent) return ROOT_CONTEXT;
  return propagation.extract(ROOT_CONTEXT, { traceparent });
}

/** `traceparent` của một span cụ thể, để gắn vào message gửi đi. */
export function traceparentOf(span: Span): string | null {
  const carrier: Record<string, string> = {};
  propagation.inject(trace.setSpan(ROOT_CONTEXT, span), carrier);
  return carrier.traceparent ?? null;
}

/**
 * Chạy `fn` trong một span con của `parent`. Lỗi thì ghi vào span (status ERROR) rồi ném tiếp. Truy vấn database, gọi HTTP bên
 * trong `fn` thành span con nhờ instrumentation tự động.
 */
export async function inSpan<T>(
  name: string,
  opts: { kind: SpanKind; parent?: Context; attributes?: Record<string, string | number | boolean> },
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return tracer().startActiveSpan(name, { kind: opts.kind, attributes: opts.attributes }, opts.parent ?? context.active(), async (span) => {
    try {
      return await fn(span);
    } catch (e) {
      span.recordException(e as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: e instanceof Error ? e.message.slice(0, 200) : String(e) });
      throw e;
    } finally {
      span.end();
    }
  });
}

/** Id trace OpenTelemetry của span đang chạy (32 ký tự hex), để ghi vào log; null khi chưa bật tracing. */
export function activeTraceId(): string | null {
  const ctx = trace.getActiveSpan()?.spanContext();
  return ctx && trace.isSpanContextValid(ctx) ? ctx.traceId : null;
}

export { SpanKind };
