/** Import đầu tiên của `main.ts`: bật OpenTelemetry trước khi nạp `http`, `pg` (ADR-15 bước 4). */
import { startTracing } from './tracing';

startTracing();
