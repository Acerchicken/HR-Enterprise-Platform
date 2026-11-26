import { Context, context, propagation, ROOT_CONTEXT, Span, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';

/**
 * Truy vết phân tán (ADR-15 bước 4). Bật khi có `OTEL_EXPORTER_OTLP_ENDPOINT` (local: Jaeger), không thì không làm gì.
 * Event từ queue mang `traceparent` (W3C) do outbox publisher của API gắn: span xử lý event là con của span gửi đi, nên một
 * trace đi từ request trên API tới service này. Viết riêng (không import `backend/`, tiêu chí ADR-15).
 */
export function startTracing(env: NodeJS.ProcessEnv = process.env): NodeSDK | null {
  if (!env.OTEL_EXPORTER_OTLP_ENDPOINT || env.OTEL_SDK_DISABLED === 'true') return null;
  const sdk = new NodeSDK({
    serviceName: env.OTEL_SERVICE_NAME || 'hr-assistant',
    traceExporter: new OTLPTraceExporter(),
    metricReaders: [],
    logRecordProcessors: [],
    instrumentations: [
      new HttpInstrumentation({ ignoreIncomingRequestHook: (req) => (req.url ?? '').includes('/health') }),
      new UndiciInstrumentation(),
      // Không ghi giá trị tham số câu lệnh (có thể là dữ liệu cá nhân).
      new PgInstrumentation({ enhancedDatabaseReporting: false }),
    ],
  });
  sdk.start();
  const stop = () => void sdk.shutdown().catch(() => undefined);
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  return sdk;
}

export function contextFromTraceparent(traceparent: string | null | undefined): Context {
  return traceparent ? propagation.extract(ROOT_CONTEXT, { traceparent }) : ROOT_CONTEXT;
}

/** Chạy `fn` trong span con của `parent`; lỗi thì ghi vào span (ERROR) rồi ném tiếp. */
export async function inSpan<T>(
  name: string,
  opts: { kind: SpanKind; parent?: Context; attributes?: Record<string, string | number | boolean> },
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return trace
    .getTracer('hr-assistant')
    .startActiveSpan(name, { kind: opts.kind, attributes: opts.attributes }, opts.parent ?? context.active(), async (span) => {
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

export { SpanKind };
