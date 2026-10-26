import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Page } from '../../common/pagination';
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
  from?: Date;
  to?: Date;
  page: number;
  size: number;
}

/**
 * Interface in-process cho các module khác ghi audit.
 * Truyền `manager` để ghi trong cùng transaction với thao tác nghiệp vụ (không mất log).
 */
@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  async record(entry: AuditEntry, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(AuditLog) : this.repo;
    await repo.insert({
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      changedFields: (entry.changedFields ?? null) as any,
      ip: entry.ip ?? null,
      traceId: entry.traceId ?? null,
    });
  }

  async search(q: AuditQuery): Promise<Page<AuditLog>> {
    const qb = this.repo.createQueryBuilder('a').orderBy('a.at', 'DESC').addOrderBy('a.id', 'DESC');
    if (q.entityType) qb.andWhere('a.entity_type = :et', { et: q.entityType });
    if (q.entityId) qb.andWhere('a.entity_id = :eid', { eid: q.entityId });
    if (q.actorId) qb.andWhere('a.actor_id = :actor', { actor: q.actorId });
    if (q.from) qb.andWhere('a.at >= :from', { from: q.from });
    if (q.to) qb.andWhere('a.at < :to', { to: q.to });
    const [items, total] = await qb
      .skip((q.page - 1) * q.size)
      .take(q.size)
      .getManyAndCount();
    return { items, page: q.page, size: q.size, total };
  }
}
