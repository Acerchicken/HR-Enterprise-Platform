import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Append-only: database có trigger chặn UPDATE/DELETE trên bảng này. */
@Entity({ schema: 'audit', name: 'audit_log' })
export class AuditLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ length: 50 })
  action: string;

  @Column({ name: 'entity_type', length: 50 })
  entityType: string;

  @Column({ name: 'entity_id', length: 64 })
  entityId: string;

  @Column({ name: 'changed_fields', type: 'jsonb', nullable: true })
  changedFields: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ name: 'trace_id', type: 'varchar', length: 64, nullable: true })
  traceId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  at: Date;
}
