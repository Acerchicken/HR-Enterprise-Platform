import { BadRequestException, ConflictException, HttpException, Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { APP_CONFIG, AppConfig } from '../../config/config';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../identity/roles';
import { AssistantConfigView, AssistantModelList, ConnectionTestResult, ListModelsDto, SaveAssistantConfigDto, TestConnectionDto } from './assistant-config.dto';

/** Bản xem cấu hình do assistant service trả (không có khóa). */
interface ServiceConfigView {
  provider: string;
  model: string;
  apiKeyLast4: string;
  enabled: boolean;
  version: number;
  updatedBy: string | null;
  updatedAt: string;
}

export const ASSISTANT_DOWN = 'Trợ lý chưa chạy hoặc không kết nối được, thử lại sau';

/**
 * Cấu hình nhà cung cấp AI cho trợ lý (UC6 FR-6.4, spec 4.2, 13.4). API kiểm quyền ADMIN (controller) và ghi audit; assistant
 * service giữ khóa mã hóa và bảng `assistant.llm_config`. Khóa API chỉ đi qua (vào service), không lưu, không log, không ghi
 * audit (AC-6.4.4).
 */
@Injectable()
export class AssistantConfigService {
  private readonly logger = new Logger('AssistantConfig');

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly audit: AuditService,
    private readonly db: DataSource,
  ) {}

  async get(): Promise<AssistantConfigView> {
    const r = await this.call<{ config: ServiceConfigView | null; providers: AssistantConfigView['providers'] }>('GET', '/internal/config');
    return this.view(r.config, r.providers);
  }

  async save(actor: AuthUser, dto: SaveAssistantConfigDto): Promise<AssistantConfigView> {
    const r = await this.call<{ before: ServiceConfigView | null; after: ServiceConfigView }>('PUT', '/internal/config', {
      provider: dto.provider,
      model: dto.model,
      apiKey: dto.apiKey,
      enabled: dto.enabled,
      version: dto.version,
      updatedBy: actor.employeeId,
    });
    const { before, after } = r;
    await this.audit.record({
      actorId: actor.employeeId,
      action: 'ASSISTANT_CONFIG_UPDATE',
      entityType: 'assistant_config',
      entityId: 'llm',
      changedFields: {
        provider: { from: before?.provider ?? null, to: after.provider },
        model: { from: before?.model ?? null, to: after.model },
        enabled: { from: before?.enabled ?? null, to: after.enabled },
        apiKeyLast4: after.apiKeyLast4,
        keyChanged: !!dto.apiKey,
      },
    });
    const { providers } = await this.call<{ providers: AssistantConfigView['providers'] }>('GET', '/internal/config');
    return this.view(after, providers);
  }

  listModels(dto: ListModelsDto): Promise<AssistantModelList> {
    return this.call<AssistantModelList>('POST', '/internal/config/models', { provider: dto.provider, apiKey: dto.apiKey });
  }

  async test(actor: AuthUser, dto: TestConnectionDto): Promise<ConnectionTestResult> {
    const r = await this.call<ConnectionTestResult>('POST', '/internal/config/test', { provider: dto.provider, model: dto.model, apiKey: dto.apiKey });
    await this.audit.record({
      actorId: actor.employeeId,
      action: 'ASSISTANT_CONFIG_TEST',
      entityType: 'assistant_config',
      entityId: 'llm',
      changedFields: { provider: dto.provider, model: dto.model, ok: r.ok, latencyMs: r.latencyMs, error: r.error?.kind ?? null, newKey: !!dto.apiKey },
    });
    return r;
  }

  private async view(c: ServiceConfigView | null, providers: AssistantConfigView['providers']): Promise<AssistantConfigView> {
    let updatedByName: string | null = null;
    if (c?.updatedBy) {
      const rows: { full_name: string }[] = await this.db.query('SELECT full_name FROM employee.employee WHERE id = $1', [c.updatedBy]);
      updatedByName = rows[0]?.full_name ?? null;
    }
    return {
      provider: c?.provider ?? null,
      model: c?.model ?? null,
      apiKeyLast4: c?.apiKeyLast4 ?? null,
      enabled: c?.enabled ?? false,
      version: c?.version ?? 0,
      updatedBy: c?.updatedBy ?? null,
      updatedByName,
      updatedAt: c?.updatedAt ?? null,
      providers,
    };
  }

  /** Gọi HTTP nội bộ assistant service; lỗi 400, 409, 503 của service chuyển nguyên cho giao diện, còn lại 503. */
  private async call<T>(method: 'GET' | 'PUT' | 'POST', path: string, body?: unknown): Promise<T> {
    const { url, internalToken, timeoutMs } = this.cfg.assistant;
    if (!url || !internalToken) throw new ServiceUnavailableException(ASSISTANT_DOWN);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${url}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${internalToken}` },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctl.signal,
      });
    } catch {
      this.logger.warn(JSON.stringify({ event: 'assistant_config_unreachable', path, timeout: ctl.signal.aborted }));
      throw new ServiceUnavailableException(ASSISTANT_DOWN);
    } finally {
      clearTimeout(timer);
    }
    const data = (await res.json().catch(() => ({}))) as { message?: string; fields?: Record<string, string> } & T;
    if (res.ok) return data;
    const payload = { message: data.message ?? 'Lỗi cấu hình trợ lý', ...(data.fields ? { fields: data.fields } : {}) };
    if (res.status === 400) throw new BadRequestException(payload);
    if (res.status === 409) throw new ConflictException(payload);
    if (res.status === 503) throw new HttpException(payload, 503);
    this.logger.warn(JSON.stringify({ event: 'assistant_config_error', path, status: res.status }));
    throw new ServiceUnavailableException(ASSISTANT_DOWN);
  }
}
