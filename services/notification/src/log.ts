/**
 * Log một dòng JSON (NFR-8.1). Không ghi địa chỉ email người nhận hay nội dung email: chỉ id event, loại event, số người nhận.
 */
type Level = 'info' | 'warn' | 'error';

function write(level: Level, msg: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ time: new Date().toISOString(), level, service: 'notification', msg, ...fields });
  (level === 'error' ? process.stderr : process.stdout).write(line + '\n');
}

export const log = {
  info: (msg: string, fields?: Record<string, unknown>) => write('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => write('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => write('error', msg, fields),
};

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);
