import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const ASSIGNMENT_REASONS = ['HIRE', 'TRANSFER', 'PROMOTION', 'MANAGER_CHANGE', 'CORRECTION'] as const;
export type AssignmentReason = (typeof ASSIGNMENT_REASONS)[number];
export type AssignmentStatus = 'SCHEDULED' | 'ACTIVE' | 'CLOSED' | 'CANCELLED' | 'FAILED';

/** Đổi trưởng đơn vị đi kèm điều chuyển (AC-2.7.5): người được điều chuyển đang là trưởng đơn vị đó. */
export interface HeadChange {
  departmentId: string;
  employeeId: string | null;
}

/** Một dòng quá trình công tác (FR-2.8). Điều chuyển tương lai là dòng SCHEDULED; job áp dụng khi tới ngày (FR-2.7). */
@Entity({ schema: 'employee', name: 'employment_assignment' })
export class EmploymentAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @Column({ name: 'department_id', type: 'uuid' })
  departmentId: string;

  @Column({ name: 'position_id', type: 'uuid' })
  positionId: string;

  @Column({ name: 'manager_id', type: 'uuid', nullable: true })
  managerId: string | null;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: string;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo: string | null;

  @Column({ type: 'varchar', length: 20 })
  reason: AssignmentReason;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 10 })
  status: AssignmentStatus;

  @Column({ name: 'failure_reason', type: 'varchar', length: 300, nullable: true })
  failureReason: string | null;

  /** Dòng của cấp dưới trỏ về điều chuyển của quản lý để hủy, áp dụng cùng nhau (AC-2.7.6). */
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ name: 'head_changes', type: 'jsonb', nullable: true })
  headChanges: HeadChange[] | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'applied_at', type: 'timestamptz', nullable: true })
  appliedAt: Date | null;
}
