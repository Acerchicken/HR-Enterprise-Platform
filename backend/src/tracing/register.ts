/**
 * Import đầu tiên của `main.ts` và `worker/main.ts`: bật OpenTelemetry trước khi nạp các module được đo (xem `start.ts`).
 * Không đặt `OTEL_EXPORTER_OTLP_ENDPOINT` thì không làm gì.
 */
import { startTracing } from './start';

startTracing(require.main?.filename.includes(`${require('path').sep}worker${require('path').sep}`) ? 'hr-worker' : 'hr-api');
