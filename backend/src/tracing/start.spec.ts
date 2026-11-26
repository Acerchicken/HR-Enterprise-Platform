import { OTLPTraceExporter as OTLPGrpcTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPTraceExporter as OTLPHttpTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { createTraceExporter, startTracing } from './start';

describe('chọn exporter trace (ADR-15 bước 4, X-Ray staging)', () => {
  it('mặc định OTLP/HTTP (Jaeger local, collector ADOT trong task ECS)', async () => {
    const exporter = createTraceExporter({ OTEL_EXPORTER_OTLP_ENDPOINT: 'http://127.0.0.1:4318' });
    expect(exporter).toBeInstanceOf(OTLPHttpTraceExporter);
    await exporter.shutdown();
  });

  it('OTEL_EXPORTER_OTLP_PROTOCOL=grpc dùng gRPC (collector của App Runner chỉ nhận gRPC)', async () => {
    const exporter = createTraceExporter({ OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4317', OTEL_EXPORTER_OTLP_PROTOCOL: 'grpc' });
    expect(exporter).toBeInstanceOf(OTLPGrpcTraceExporter);
    await exporter.shutdown();
  });

  it('biến riêng cho trace được ưu tiên hơn biến chung', async () => {
    const exporter = createTraceExporter({ OTEL_EXPORTER_OTLP_PROTOCOL: 'grpc', OTEL_EXPORTER_OTLP_TRACES_PROTOCOL: 'http/protobuf' });
    expect(exporter).toBeInstanceOf(OTLPHttpTraceExporter);
    await exporter.shutdown();
  });

  it('không đặt endpoint thì không khởi động SDK', () => {
    expect(startTracing('hr-api', {})).toBeNull();
  });
});
