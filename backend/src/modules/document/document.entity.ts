import { Column, CreateDateColumn, Entity, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn, VersionColumn } from 'typeorm';

export const DOCUMENT_TYPES = ['POLICY', 'PROCESS', 'GUIDE', 'FORM', 'NOTICE'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type VersionStatus = 'PENDING' | 'READY' | 'REJECTED';

@Entity({ schema: 'document', name: 'document' })
export class DocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'varchar' })
  type: DocumentType;

  @Column({ name: 'scope_all' })
  scopeAll: boolean;

  @Column()
  hidden: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @VersionColumn()
  version: number;
}

@Entity({ schema: 'document', name: 'document_scope' })
export class DocumentScope {
  @PrimaryColumn({ name: 'document_id', type: 'uuid' })
  documentId: string;

  @PrimaryColumn({ type: 'varchar' })
  kind: 'DEPARTMENT' | 'ROLE';

  @PrimaryColumn()
  value: string;
}

@Entity({ schema: 'document', name: 'document_version' })
export class DocumentVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId: string;

  @Column({ name: 'version_no' })
  versionNo: number;

  @Column({ type: 'varchar' })
  status: VersionStatus;

  @Column({ name: 'object_key' })
  objectKey: string;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'content_type' })
  contentType: string;

  @Column({ name: 'size_bytes' })
  sizeBytes: number;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'ready_at', type: 'timestamptz', nullable: true })
  readyAt: Date | null;
}
