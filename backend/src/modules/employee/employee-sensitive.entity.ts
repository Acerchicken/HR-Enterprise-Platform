import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Trường nhạy cảm tách bảng riêng, lưu ở dạng đã mã hóa (AES-256-GCM). Chỉ HR được đọc. */
@Entity({ schema: 'employee', name: 'employee_sensitive' })
export class EmployeeSensitive {
  @PrimaryColumn({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @Column({ name: 'national_id_enc', type: 'text', nullable: true })
  nationalIdEnc: string | null;

  @Column({ name: 'bank_account_enc', type: 'text', nullable: true })
  bankAccountEnc: string | null;

  @Column({ name: 'salary_enc', type: 'text', nullable: true })
  salaryEnc: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
