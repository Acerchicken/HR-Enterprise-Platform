import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ schema: 'leave', name: 'leave_balance' })
export class LeaveBalance {
  @PrimaryColumn({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @PrimaryColumn({ name: 'leave_type_id', type: 'uuid' })
  leaveTypeId: string;

  @PrimaryColumn({ type: 'smallint' })
  year: number;

  @Column({ type: 'numeric', precision: 5, scale: 1 })
  entitled: string;

  @Column({ type: 'numeric', precision: 5, scale: 1 })
  used: string;

  @Column({ type: 'numeric', precision: 5, scale: 1 })
  pending: string;
}
