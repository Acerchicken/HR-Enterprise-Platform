import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

export type EmployeeStatus = 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED';

@Entity({ schema: 'employee', name: 'employee' })
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_code', length: 20, unique: true })
  employeeCode: string;

  @Column({ name: 'full_name', length: 150 })
  fullName: string;

  @Column({ name: 'work_email', length: 150, unique: true })
  workEmail: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string | null;

  @Column({ name: 'department_id', type: 'uuid' })
  departmentId: string;

  @Column({ name: 'position_id', type: 'uuid' })
  positionId: string;

  @Column({ name: 'manager_id', type: 'uuid', nullable: true })
  managerId: string | null;

  @Column({ name: 'hire_date', type: 'date' })
  hireDate: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: EmployeeStatus;

  /** Optimistic locking: client gửi kèm version khi PATCH, lệch thì trả 409. */
  @VersionColumn()
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
