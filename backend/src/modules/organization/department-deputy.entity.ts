import { CreateDateColumn, Column, Entity, PrimaryColumn } from 'typeorm';

/** Phó đơn vị ở mọi cấp (FR-2.9, ADR-14). Số phó tối đa theo loại đơn vị kiểm ở service. */
@Entity({ schema: 'org', name: 'department_deputy' })
export class DepartmentDeputy {
  @PrimaryColumn({ name: 'department_id', type: 'uuid' })
  departmentId: string;

  /** Tham chiếu logic sang employee.employee (không FK chéo schema). */
  @PrimaryColumn({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
