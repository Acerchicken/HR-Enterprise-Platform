import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'leave', name: 'leave_type' })
export class LeaveType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20, unique: true })
  code: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'max_days_per_year', type: 'numeric', precision: 5, scale: 1 })
  maxDaysPerYear: string;
}
