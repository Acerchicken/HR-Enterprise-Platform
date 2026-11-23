import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Page } from '../../common/pagination';
import { currentRequest } from '../../common/request-context';
import { AuditLog } from './audit-log.entity';

export interface AuditEntry {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  changedFields?: Record<string, unknown> | null;
  ip?: string | null;
  traceId?: string | null;
}

export interface AuditQuery {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  actions?: string[];
  /** Loại đối tượng người gọi không được thấy (UC7 D1). */
  excludeEntityTypes?: string[];
  /** Tính cả mốc. */
  from?: Date;
  /** Không tính mốc. */
  toExclusive?: Date;
  page: number;
  size: number;
}

/** Một dòng tra cứu: bản ghi audit kèm tên người thực hiện (`null` với job, worker hoặc hồ sơ không còn). */
export type AuditLogView = AuditLog & { actorName: string | null };

/**
 * Interface in-process cho các module khác ghi audit.
 * Truyền `manager` để ghi trong cùng transaction với thao tác nghiệp vụ (không mất log).
 */
@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  /**
   * `ip`, `traceId` không truyền thì lấy từ request HTTP đang chạy (UC7 AC-7.1.4). Job, worker không có request: để NULL.
   */
  async record(entry: AuditEntry, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(AuditLog) : this.repo;
    const ctx = currentRequest();
    await repo.insert({
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      changedFields: (entry.changedFields ?? null) as any,
      ip: entry.ip ?? ctx?.ip ?? null,
      traceId: entry.traceId ?? ctx?.traceId ?? null,
    });
  }

  async search(q: AuditQuery): Promise<Page<AuditLogView>> {
    const qb = this.repo.createQueryBuilder('a').orderBy('a.at', 'DESC').addOrderBy('a.id', 'DESC');
    if (q.entityType) qb.andWhere('a.entity_type = :et', { et: q.entityType });
    if (q.entityId) qb.andWhere('a.entity_id = :eid', { eid: q.entityId });
    if (q.actorId) qb.andWhere('a.actor_id = :actor', { actor: q.actorId });
    if (q.actions?.length) qb.andWhere('a.action IN (:...actions)', { actions: q.actions });
    if (q.excludeEntityTypes?.length) qb.andWhere('a.entity_type NOT IN (:...hidden)', { hidden: q.excludeEntityTypes });
    if (q.from) qb.andWhere('a.at >= :from', { from: q.from });
    if (q.toExclusive) qb.andWhere('a.at < :to', { to: q.toExclusive });
    const [items, total] = await qb
      .skip((q.page - 1) * q.size)
      .take(q.size)
      .getManyAndCount();
    const names = await this.actorNames(items.map((a) => a.actorId));
    return {
      items: items.map((a) => ({ ...a, actorName: a.actorId ? (names.get(a.actorId) ?? null) : null })),
      page: q.page,
      size: q.size,
      total,
    };
  }

  /** Tên hồ sơ của người thực hiện, một truy vấn cho cả trang. Đọc thẳng bảng để Audit không phụ thuộc module Employee. */
  private async actorNames(ids: (string | null)[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((x): x is string => !!x))];
    if (!unique.length) return new Map();
    const rows: { id: string; full_name: string }[] = await this.repo.manager.query(
      'SELECT id, full_name FROM employee.employee WHERE id = ANY($1::uuid[])',
      [unique],
    );
    return new Map(rows.map((r) => [r.id, r.full_name]));
  }

  /**
   * Nhật ký của một đối tượng (UC1 FR-1.11): lọc thêm theo `changedFields.section` và danh sách thao tác. Mới nhất trước.
   */
  async history(q: {
    entityType: string;
    entityId: string;
    actions?: string[];
    section?: string;
    actorId?: string;
    from?: Date;
    to?: Date;
    page: number;
    size: number;
  }): Promise<Page<AuditLog>> {
    const qb = this.repo
      .createQueryBuilder('a')
      .where('a.entity_type = :et AND a.entity_id = :eid', { et: q.entityType, eid: q.entityId })
      .orderBy('a.at', 'DESC')
      .addOrderBy('a.id', 'DESC');
    if (q.actions?.length) qb.andWhere('a.action IN (:...actions)', { actions: q.actions });
    if (q.section) qb.andWhere(`a.changed_fields ->> 'section' = :section`, { section: q.section });
    if (q.actorId) qb.andWhere('a.actor_id = :actor', { actor: q.actorId });
    if (q.from) qb.andWhere('a.at >= :from', { from: q.from });
    if (q.to) qb.andWhere('a.at < :to', { to: q.to });
    const [items, total] = await qb.skip((q.page - 1) * q.size).take(q.size).getManyAndCount();
    return { items, page: q.page, size: q.size, total };
  }
}
