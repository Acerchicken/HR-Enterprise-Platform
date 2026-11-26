import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter as OTLPGrpcTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPTraceExporter as OTLPHttpTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';

/**
 * Khởi động OpenTelemetry SDK. Phải chạy **trước** khi nạp `http`, `express`, `pg` (instrumentation vá module lúc nạp), nên
 * `main.ts` và `worker/main.ts` import file `register.ts` đầu tiên. Tên service: `OTEL_SERVICE_NAME`, mặc định theo tiến trình.
 * Exporter đọc `OTEL_EXPORTER_OTLP_ENDPOINT` (local: `http://jaeger:4318`); tỉ lệ lấy mẫu theo biến chuẩn
 * `OTEL_TRACES_SAMPLER`, `OTEL_TRACES_SAMPLER_ARG` (mặc định lấy hết).
 */
export function startTracing(defaultServiceName: string, env: NodeJS.ProcessEnv = process.env): NodeSDK | null {
  if (!env.OTEL_EXPORTER_OTLP_ENDPOINT || env.OTEL_SDK_DISABLED === 'true') return null;
  const sdk = new NodeSDK({
    serviceName: env.OTEL_SERVICE_NAME || defaultServiceName,
    traceExporter: createTraceExporter(env),
    // Chỉ metric, log riêng (NFR-8.x đã có log JSON, metric EMF); tắt exporter metric, log mặc định của SDK.
    metricReaders: [],
    logRecordProcessors: [],
    instrumentations: [
      // Bỏ healthcheck để không đầy trace vô ích.
      new HttpInstrumentation({ ignoreIncomingRequestHook: (req) => (req.url ?? '').includes('/health') }),
      // fetch() của Node (API gọi assistant service): span con và header traceparent sang service.
      new UndiciInstrumentation(),
      new ExpressInstrumentation(),
      new NestInstrumentation(),
      // Chỉ ghi câu lệnh có tham số ($1...), không ghi giá trị tham số (có thể là dữ liệu cá nhân).
      new PgInstrumentation({ enhancedDatabaseReporting: false }),
    ],
  });
  sdk.start();
  const stop = () => void sdk.shutdown().catch(() => undefined);
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  return sdk;
}

/**
 * OTLP/HTTP mặc định (Jaeger local, collector ADOT chạy kèm task ECS). `OTEL_EXPORTER_OTLP_PROTOCOL=grpc` dùng gRPC: collector
 * mà App Runner chạy cho X-Ray chỉ nhận gRPC ở `localhost:4317` (infra/staging/tracing.tf).
 */
export function createTraceExporter(env: NodeJS.ProcessEnv = process.env): OTLPGrpcTraceExporter | OTLPHttpTraceExporter {
  const protocol = env.OTEL_EXPORTER_OTLP_TRACES_PROTOCOL || env.OTEL_EXPORTER_OTLP_PROTOCOL;
  return protocol === 'grpc' ? new OTLPGrpcTraceExporter() : new OTLPHttpTraceExporter();
}
