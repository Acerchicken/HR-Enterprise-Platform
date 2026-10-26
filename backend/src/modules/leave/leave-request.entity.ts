import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { LeaveStatus } from './leave-state-machine';

@Entity({ schema: 'leave', name: 'leave_request' })
export class LeaveRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @Column({ name: 'leave_type_id', type: 'uuid' })
  leaveTypeId: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ type: 'numeric', precision: 5, scale: 1 })
  days: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason: string | null;

  @Column({ type: 'varchar', length: 20 })
  status: LeaveStatus;

  @Column({ name: 'approver_id', type: 'uuid' })
  approverId: string;

  @VersionColumn()
  version: number;

  @Column({ name: 'idempotency_key', length: 100 })
  idempotencyKey: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

@Entity({ schema: 'leave', name: 'leave_request_history' })
export class LeaveRequestHistory {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'request_id', type: 'uuid' })
  requestId: string;

  @Column({ name: 'from_status', type: 'varchar', length: 20, nullable: true })
  fromStatus: LeaveStatus | null;

  @Column({ name: 'to_status', type: 'varchar', length: 20 })
  toStatus: LeaveStatus;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  comment: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  at: Date;
}
