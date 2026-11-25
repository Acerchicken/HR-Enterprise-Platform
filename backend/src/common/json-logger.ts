import { LoggerService, LogLevel } from '@nestjs/common';
import { Request, Response } from 'express';
import { currentRequest } from './request-context';

type Write = (line: string) => void;

/**
 * Log một dòng JSON mỗi bản ghi (NFR-8.1), để CloudWatch Logs Insights lọc theo `traceId`, `level`, `context`:
 * `{"time","level","service","context","msg","traceId"?,"stack"?}`. `traceId` lấy từ request context (TraceIdMiddleware), nên
 * mọi log trong một request có cùng mã với header `X-Trace-Id` (NFR-6.4). Không ghi body hay tham số SQL (dữ liệu cá nhân).
 */
export class JsonLogger implements LoggerService {
  constructor(
    private readonly service: string,
    private readonly version: string,
    private readonly write: Write = (line) => process.stdout.write(line + '\n'),
  ) {}

  log(message: unknown, ...rest: unknown[]) {
    this.emit('info', message, rest);
  }
  error(message: unknown, ...rest: unknown[]) {
    this.emit('error', message, rest, true);
  }
  warn(message: unknown, ...rest: unknown[]) {
    this.emit('warn', message, rest);
  }
  debug(message: unknown, ...rest: unknown[]) {
    this.emit('debug', message, rest);
  }
  verbose(message: unknown, ...rest: unknown[]) {
    this.emit('verbose', message, rest);
  }
  setLogLevels?(_levels: LogLevel[]) {}

  /**
   * Số đo dạng CloudWatch Embedded Metric Format: CloudWatch tự tạo metric từ dòng log này, không cần SDK hay quyền
   * `cloudwatch:PutMetricData` (NFR-8.2). Namespace `HRHelper`, dimension `Service`.
   */
  metric(name: string, value: number, unit: 'Count' | 'Seconds' | 'Milliseconds' = 'Count') {
    this.write(
      JSON.stringify({
        _aws: {
          Timestamp: Date.now(),
          CloudWatchMetrics: [{ Namespace: 'HRHelper', Dimensions: [['Service']], Metrics: [{ Name: name, Unit: unit }] }],
        },
        Service: this.service,
        [name]: value,
        level: 'metric',
        version: this.version,
      }),
    );
  }

  access(fields: { method: string; path: string; status: number; durationMs: number; traceId: string }) {
    this.write(JSON.stringify({ time: new Date().toISOString(), level: 'info', service: this.service, version: this.version, context: 'HTTP', msg: 'request', ...fields }));
  }

  /** Nest gọi `log(message, context)` và `error(message, stack, context)`; tham số cuối là context nếu là chuỗi. */
  private emit(level: string, message: unknown, rest: unknown[], isError = false) {
    const args = [...rest];
    const context = args.length && typeof args[args.length - 1] === 'string' ? (args.pop() as string) : undefined;
    let stack = isError && typeof args[0] === 'string' ? (args[0] as string) : undefined;
    let msg: unknown = message;
    if (message instanceof Error) {
      msg = message.message;
      stack ??= message.stack;
    }
    const traceId = currentRequest()?.traceId;
    this.write(
      JSON.stringify({
        time: new Date().toISOString(),
        level,
        service: this.service,
        version: this.version,
        ...(context ? { context } : {}),
        msg,
        ...(traceId ? { traceId } : {}),
        ...(stack ? { stack } : {}),
      }),
    );
  }
}

/** Metric chỉ có ý nghĩa với log JSON (CloudWatch); log dạng text thì bỏ qua. */
export interface MetricSink {
  metric(name: string, value: number, unit?: 'Count' | 'Seconds' | 'Milliseconds'): void;
}

let sink: MetricSink = { metric: () => undefined };

/** Gắn nơi nhận metric (JsonLogger) khi khởi động process; test và dev dùng sink rỗng. */
export function setMetricSink(m: MetricSink) {
  sink = m;
}

export function metrics(): MetricSink {
  return sink;
}

/**
 * Access log: một dòng mỗi request khi log JSON (method, đường dẫn không có query, status, thời gian), để đo p95 và tỉ lệ 5xx
 * bằng Logs Insights và tìm request theo traceId. Không ghi query string (có thể chứa từ khóa tìm kiếm tên người).
 */
export function accessLog(logger: JsonLogger) {
  return (req: Request, res: Response, next: () => void) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      logger.access({
        method: req.method,
        path: (req.originalUrl ?? req.url).split('?')[0],
        status: res.statusCode,
        durationMs: Math.round(ms * 10) / 10,
        traceId: String(res.getHeader('X-Trace-Id') ?? ''),
      });
    });
    next();
  };
}
