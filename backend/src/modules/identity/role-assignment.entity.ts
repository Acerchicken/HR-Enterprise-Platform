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

  /** Tài khoản ADMIN đã cấp (FR-8.7); null với dòng seed hoặc có từ trước UC8. */
  @Column({ name: 'granted_by', type: 'uuid', nullable: true })
  grantedBy: string | null;

  @Column({ name: 'granted_at', type: 'timestamptz', default: () => 'now()' })
  grantedAt: Date;

  @Column({ type: 'varchar', length: 200, nullable: true })
  reason: string | null;
}
