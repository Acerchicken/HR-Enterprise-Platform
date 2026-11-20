import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type IdpStatus = 'PENDING' | 'INVITED' | 'ACTIVE' | 'DISABLED' | 'FAILED';

@Entity({ schema: 'iam', name: 'user_account' })
export class UserAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Claim `sub` của token OIDC; null cho tới lần đăng nhập đầu tiên. */
  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  subject: string | null;

  @Column({ length: 150, unique: true })
  email: string;

  @Column({ name: 'employee_id', type: 'uuid', nullable: true })
  employeeId: string | null;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  /** UC8 FR-8.6: PENDING, INVITED, ACTIVE, DISABLED, FAILED (sơ đồ g1). */
  @Column({ name: 'idp_status', type: 'varchar', length: 10, default: 'ACTIVE' })
  idpStatus: IdpStatus;

  @Column({ name: 'invited_at', type: 'timestamptz', nullable: true })
  invitedAt: Date | null;

  @Column({ name: 'idp_synced_at', type: 'timestamptz', nullable: true })
  idpSyncedAt: Date | null;

  /** Chỉ mã lỗi (IDP_UNAVAILABLE, IDP_REJECTED, IDP_USER_NOT_FOUND), không có dữ liệu cá nhân. */
  @Column({ name: 'idp_error', type: 'varchar', length: 40, nullable: true })
  idpError: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
