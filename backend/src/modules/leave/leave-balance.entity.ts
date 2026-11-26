import { Column, Entity, PrimaryColumn } from 'typeorm';
import { numeric } from './numeric';

export type BalanceSource = 'AUTO' | 'DEFAULT' | 'MANUAL';

/** Số dư theo (nhân viên, loại phép, năm), chỉ loại `ACCRUED`, `YEARLY` (UC3 spec 13.3). */
@Entity({ schema: 'leave', name: 'leave_balance' })
export class LeaveBalance {
  @PrimaryColumn({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @PrimaryColumn({ name: 'leave_type_id', type: 'uuid' })
  leaveTypeId: string;

  @PrimaryColumn({ type: 'smallint' })
  year: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, transformer: numeric })
  entitled: number;

  /** Phép năm chuyển từ năm trước, hết hạn 31/12 của `year` (BR-01, AC-3.1.8). */
  @Column({ name: 'carried_in', type: 'numeric', precision: 5, scale: 2, transformer: numeric })
  carriedIn: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, transformer: numeric })
  used: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, transformer: numeric })
  pending: number;

  /** Mức nền phép năm 12, 14, 16 do HR đặt (FR-3.8); null là 12. */
  @Column({ name: 'base_days', type: 'numeric', precision: 5, scale: 2, nullable: true, transformer: numeric })
  baseDays: number | null;

  @Column({ type: 'varchar', length: 8 })
  source: BalanceSource;

  @Column({ type: 'varchar', length: 200, nullable: true })
  note: string | null;

  @Column({ type: 'int' })
  version: number;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @Column({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updatedAt: Date | null;
}
