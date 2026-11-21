import { Column, CreateDateColumn, Entity, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn, VersionColumn } from 'typeorm';
import { HalfDay } from './leave-rules';
import { HistoryAction, LeaveStatus } from './leave-state-machine';
import { numeric } from './numeric';

@Entity({ schema: 'leave', name: 'leave_request' })
export class LeaveRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Chủ đơn: người nghỉ, chủ số dư. */
  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  /** Người tạo đơn; khác chủ đơn khi HR, quản lý tạo hộ (BR-12). */
  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @Column({ name: 'leave_type_id', type: 'uuid' })
  leaveTypeId: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  /** Nghỉ nửa ngày buổi sáng/chiều (BR-04); null là nghỉ cả ngày. */
  @Column({ name: 'half_day', type: 'varchar', length: 2, nullable: true })
  halfDay: HalfDay | null;

  /** Ngày sự kiện của loại nghỉ theo sự kiện (AC-3.2.6). */
  @Column({ name: 'event_date', type: 'date', nullable: true })
  eventDate: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 1, transformer: numeric })
  days: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason: string | null;

  @Column({ type: 'varchar', length: 20 })
  status: LeaveStatus;

  /** Cấu hình BR-16 chụp lúc gửi. */
  @Column({ name: 'requires_hr_approval', type: 'boolean' })
  requiresHrApproval: boolean;

  /** Người ra quyết định gần nhất (quản lý, người duyệt thay, HR). */
  @Column({ name: 'approver_id', type: 'uuid', nullable: true })
  approverId: string | null;

  @Column({ name: 'stage_entered_at', type: 'timestamptz' })
  stageEnteredAt: Date;

  @Column({ name: 'reminded_at', type: 'timestamptz', nullable: true })
  remindedAt: Date | null;

  @Column({ name: 'cancel_requested_at', type: 'timestamptz', nullable: true })
  cancelRequestedAt: Date | null;

  @Column({ name: 'cancel_requested_by', type: 'uuid', nullable: true })
  cancelRequestedBy: string | null;

  @VersionColumn()
  version: number;

  @Column({ name: 'idempotency_key', length: 100 })
  idempotencyKey: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

/** Số ngày của đơn theo từng năm (UC3 13.4), chỉ loại có số dư. */
@Entity({ schema: 'leave', name: 'leave_request_allocation' })
export class LeaveAllocation {
  @PrimaryColumn({ name: 'request_id', type: 'uuid' })
  requestId: string;

  @PrimaryColumn({ type: 'smallint' })
  year: number;

  @Column({ type: 'numeric', precision: 5, scale: 1, transformer: numeric })
  days: number;
}

@Entity({ schema: 'leave', name: 'leave_request_history' })
export class LeaveRequestHistory {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'request_id', type: 'uuid' })
  requestId: string;

  @Column({ type: 'varchar', length: 30 })
  action: HistoryAction;

  @Column({ name: 'from_status', type: 'varchar', length: 20, nullable: true })
  fromStatus: LeaveStatus | null;

  @Column({ name: 'to_status', type: 'varchar', length: 20 })
  toStatus: LeaveStatus;

  /** NULL khi hệ thống thực hiện (hủy khi nghỉ việc). */
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  comment: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  at: Date;
}
