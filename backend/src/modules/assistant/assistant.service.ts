import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { APP_CONFIG, AppConfig } from '../../config/config';
import { DocumentService } from '../document/document.service';
import { AuthUser } from '../identity/roles';
import { AssistantAnswer } from './assistant.dto';

export const NOT_FOUND_ANSWER = 'Mình không tìm thấy nội dung này trong các tài liệu bạn được xem, bạn hãy liên hệ phòng Nhân sự.';
export const UNAVAILABLE_ANSWER = 'Trợ lý tạm thời không dùng được. Bạn vẫn có thể xem danh sách tài liệu bên trái.';

/**
 * BFF của trợ lý chính sách (UC6 spec 4.1, ADR-15, ADR-16 mục 5): tính phạm vi người hỏi ở thời điểm hỏi (DR-06) rồi gọi nội
 * bộ assistant service. Không lưu, không log câu hỏi (NFR-11.1).
 */
@Injectable()
export class AssistantService {
  private readonly logger = new Logger('Assistant');

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly docs: DocumentService,
  ) {}

  async ask(actor: AuthUser, question: string, traceId: string | null): Promise<AssistantAnswer> {
    const viewer = await this.docs.viewerOf(actor);
    // Không có hồ sơ đang làm việc: không xem được tài liệu nào, kể cả "toàn công ty" (DR-02). Không gọi service, vì phạm vi
    // rỗng vẫn khớp điều kiện scope_all (ADR-16 mục 5).
    if (!viewer.active) return { answer: NOT_FOUND_ANSWER, citations: [], fallback: false, masked: false };

    const { url, internalToken, timeoutMs } = this.cfg.assistant;
    const unavailable = (reason: string, extra: Record<string, unknown> = {}): AssistantAnswer => {
      this.logger.warn(JSON.stringify({ event: 'assistant_unavailable', reason, traceId, ...extra }));
      return { answer: UNAVAILABLE_ANSWER, citations: [], fallback: true, masked: false, documents: [] };
    };
    if (!url || !internalToken) return unavailable('not_configured');

    const started = Date.now();
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(`${url}/internal/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${internalToken}`, traceparent: traceparentOf(traceId) },
        body: JSON.stringify({ question, scope: { unitIds: viewer.departmentChain, roles: viewer.roles } }),
        signal: ctl.signal,
      });
      if (!res.ok) return unavailable('http_error', { status: res.status });
      const body = (await res.json()) as AssistantAnswer;
      if (typeof body?.answer !== 'string' || !Array.isArray(body.citations)) return unavailable('bad_response');
      this.logger.log(JSON.stringify({ event: 'assistant_answer', traceId, fallback: body.fallback, citations: body.citations.length, ms: Date.now() - started }));
      return {
        answer: body.answer,
        citations: body.citations,
        fallback: !!body.fallback,
        masked: !!body.masked,
        ...(body.fallback ? { documents: body.documents ?? [] } : {}),
      };
    } catch (e) {
      return unavailable(ctl.signal.aborted ? 'timeout' : 'unreachable');
    } finally {
      clearTimeout(timer);
    }
  }
}

/** W3C traceparent từ traceId của request (uuid hoặc chuỗi hex 32 ký tự), để nối log API với assistant service. */
export function traceparentOf(traceId: string | null): string {
  const hex = (traceId ?? '').replace(/-/g, '').toLowerCase();
  const trace = /^[0-9a-f]{32}$/.test(hex) && !/^0+$/.test(hex) ? hex : randomBytes(16).toString('hex');
  return `00-${trace}-${randomBytes(8).toString('hex')}-01`;
}
