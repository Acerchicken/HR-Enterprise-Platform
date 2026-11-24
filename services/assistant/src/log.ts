/**
 * Log một dòng JSON. Không bao giờ ghi nội dung tài liệu, câu hỏi, câu trả lời hay khóa API (ADR-16 mục 10, NFR-11.1):
 * chỉ id, số lượng, thời gian, lý do.
 */
type Level = 'info' | 'warn' | 'error';

function write(level: Level, msg: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ at: new Date().toISOString(), level, service: 'assistant', msg, ...fields });
  (level === 'error' ? process.stderr : process.stdout).write(line + '\n');
}

export const log = {
  info: (msg: string, fields?: Record<string, unknown>) => write('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => write('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => write('error', msg, fields),
};

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);
