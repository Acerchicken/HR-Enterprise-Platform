import { Column, Entity, PrimaryColumn } from 'typeorm';
import { Role } from './roles';

@Entity({ schema: 'iam', name: 'role_assignment' })
export class RoleAssignment {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @PrimaryColumn({ type: 'varchar', length: 20 })
  role: Role;

  /** Phạm vi phòng ban cho HR (ABAC – dùng từ tuần 9). null = toàn công ty. */
  @Column({ name: 'scope_department_id', type: 'uuid', nullable: true })
  scopeDepartmentId: string | null;
}
