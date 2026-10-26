import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
