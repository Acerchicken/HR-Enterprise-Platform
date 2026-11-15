import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, VersionColumn } from 'typeorm';

/** Một dòng của mục hồ sơ (liên hệ khẩn cấp, thân nhân, chuyên môn, tài khoản ngân hàng…), spec 13.1. */
@Entity({ schema: 'employee', name: 'profile_item' })
export class ProfileItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @Column({ type: 'varchar', length: 40 })
  section: string;

  @Column({ type: 'jsonb', default: {} })
  data: Record<string, unknown>;

  /** Trường nhạy cảm của dòng: JSON đã mã hóa AES-256-GCM (ADR-08). */
  @Column({ name: 'sensitive_data', type: 'text', nullable: true })
  sensitiveData: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @Column({ name: 'change_request_id', type: 'uuid', nullable: true })
  changeRequestId: string | null;

  @VersionColumn()
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}

export type ChangeAction = 'CREATE' | 'UPDATE' | 'DELETE';
export type ChangeStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

/** Yêu cầu cập nhật hồ sơ do nhân viên gửi, HR duyệt (FR-1.9). */
@Entity({ schema: 'employee', name: 'profile_change_request' })
export class ProfileChangeRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @Column({ type: 'varchar', length: 40 })
  section: string;

  @Column({ type: 'varchar', length: 10 })
  action: ChangeAction;

  @Column({ name: 'item_id', type: 'uuid', nullable: true })
  itemId: string | null;

  @Column({ name: 'base_version', type: 'int', nullable: true })
  baseVersion: number | null;

  @Column({ type: 'jsonb', default: {} })
  proposed: Record<string, unknown>;

  @Column({ name: 'proposed_sensitive', type: 'text', nullable: true })
  proposedSensitive: string | null;

  @Column({ name: 'file_ids', type: 'uuid', array: true, default: () => "'{}'" })
  fileIds: string[];

  @Column({ type: 'varchar', length: 10, default: 'PENDING' })
  status: ChangeStatus;

  @Column({ name: 'submitted_by', type: 'uuid' })
  submittedBy: string;

  @CreateDateColumn({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt: Date;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  /** Chỉ hiện cho chủ hồ sơ và HR; không bao giờ vào audit (spec mục 7). */
  @Column({ name: 'reject_reason', type: 'varchar', length: 500, nullable: true })
  rejectReason: string | null;

  /** Nhân viên đã đóng thông báo bị từ chối (spec 9.1). */
  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt: Date | null;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 100 })
  idempotencyKey: string;
}

export type FileStatus = 'PENDING' | 'PENDING_REVIEW' | 'READY' | 'REJECTED' | 'DELETED';

/** File hồ sơ (FR-1.10). Object nằm ở `profiles/{employeeId}/{fileId}` trên bucket hồ sơ; tên file gốc không vào log, audit. */
@Entity({ schema: 'employee', name: 'profile_file' })
export class ProfileFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @Column({ type: 'varchar', length: 40 })
  section: string;

  @Column({ name: 'item_id', type: 'uuid', nullable: true })
  itemId: string | null;

  @Column({ name: 'storage_key', type: 'varchar', length: 200 })
  storageKey: string;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName: string;

  @Column({ name: 'content_type', type: 'varchar', length: 100 })
  contentType: string;

  @Column({ name: 'size_bytes', type: 'int' })
  sizeBytes: number;

  @Column({ type: 'char', length: 64 })
  sha256: string;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: FileStatus;

  @Column({ name: 'uploaded_by', type: 'uuid' })
  uploadedBy: string;

  /** File HR tải lên: READY ngay, nhân viên không đề xuất xóa được (A8, E14). */
  @Column({ name: 'uploaded_by_hr', type: 'boolean', default: false })
  uploadedByHr: boolean;

  @Column({ name: 'change_request_id', type: 'uuid', nullable: true })
  changeRequestId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
