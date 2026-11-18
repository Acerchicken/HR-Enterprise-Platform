import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { UnitStatus, UnitType } from './unit-rules';

@Entity({ schema: 'org', name: 'department' })
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20, unique: true })
  code: string;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 50 })
  office: string;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  /** ADR-14: COMPANY, CENTER, DEPARTMENT, TEAM. */
  @Column({ name: 'unit_type', type: 'varchar', length: 12 })
  unitType: UnitType;

  /** FR-2.10: đơn vị ngừng hoạt động không hiện trong cây, danh bạ, danh sách chọn. */
  @Column({ type: 'varchar', length: 10, default: 'ACTIVE' })
  status: UnitStatus;

  @Column({ name: 'head_employee_id', type: 'uuid', nullable: true })
  headEmployeeId: string | null;

  /** FR-2.9: "Quyền trưởng" (người phụ trách khi chưa bổ nhiệm chính thức). Chỉ khác tên hiển thị. */
  @Column({ name: 'head_acting', default: false })
  headActing: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
