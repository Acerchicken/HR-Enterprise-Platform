import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { HrApproval, QuotaKind } from './leave-rules';
import { numeric } from './numeric';

/** Danh mục loại phép (docs/business/leave-types-holidays.md, UC3 spec 13.3, UC4 13.3). */
@Entity({ schema: 'leave', name: 'leave_type' })
export class LeaveType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20, unique: true })
  code: string;

  @Column({ length: 100 })
  name: string;

  /** Hạn mức mặc định của loại `YEARLY` (nghỉ ốm, không lương); `ANNUAL` tính theo BR-01. */
  @Column({ name: 'max_days_per_year', type: 'numeric', precision: 5, scale: 1, transformer: numeric })
  maxDaysPerYear: number;

  @Column({ name: 'quota_kind', type: 'varchar', length: 10 })
  quotaKind: QuotaKind;

  @Column({ name: 'max_days_per_event', type: 'numeric', precision: 5, scale: 1, nullable: true, transformer: numeric })
  maxDaysPerEvent: number | null;

  @Column({ name: 'max_months_per_event', type: 'smallint', nullable: true })
  maxMonthsPerEvent: number | null;

  @Column({ name: 'requires_event_date', type: 'boolean' })
  requiresEventDate: boolean;

  @Column({ name: 'requires_document', type: 'boolean' })
  requiresDocument: boolean;

  @Column({ name: 'hr_approval', type: 'varchar', length: 10 })
  hrApproval: HrApproval;

  @Column({ name: 'hr_approval_min_days', type: 'numeric', precision: 5, scale: 1, nullable: true, transformer: numeric })
  hrApprovalMinDays: number | null;
}
