import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tuần 10 – kho tài liệu HR (UC5, docs/business/document-rules.md):
 * - document.document: metadata (tiêu đề, loại, phạm vi toàn công ty, ẩn/hiện).
 * - document.document_scope: phạm vi theo phòng ban hoặc vai trò (cộng dồn, DR-02).
 * - document.document_version: mỗi file là một phiên bản, không ghi đè (DR-04); file nằm ở object storage.
 */
export class Documents1731300000000 implements MigrationInterface {
  name = 'Documents1731300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE SCHEMA IF NOT EXISTS document`);
    await q.query(`
      CREATE TABLE document.document (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title       varchar(200) NOT NULL,
        type        varchar(20) NOT NULL CHECK (type IN ('POLICY','PROCESS','GUIDE','FORM','NOTICE')),
        scope_all   boolean NOT NULL DEFAULT false,
        hidden      boolean NOT NULL DEFAULT false,
        created_by  uuid,
        created_at  timestamptz NOT NULL DEFAULT now(),
        updated_at  timestamptz NOT NULL DEFAULT now(),
        version     integer NOT NULL DEFAULT 1
      )`);
    await q.query(`
      CREATE TABLE document.document_scope (
        document_id uuid NOT NULL REFERENCES document.document(id) ON DELETE CASCADE,
        kind        varchar(12) NOT NULL CHECK (kind IN ('DEPARTMENT','ROLE')),
        value       varchar(64) NOT NULL,
        PRIMARY KEY (document_id, kind, value)
      )`);
    await q.query(`CREATE INDEX ix_document_scope_value ON document.document_scope(kind, value)`);
    await q.query(`
      CREATE TABLE document.document_version (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id  uuid NOT NULL REFERENCES document.document(id) ON DELETE CASCADE,
        version_no   integer NOT NULL,
        status       varchar(10) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','READY','REJECTED')),
        object_key   varchar(300) NOT NULL,
        file_name    varchar(255) NOT NULL,
        content_type varchar(100) NOT NULL,
        size_bytes   integer NOT NULL,
        uploaded_by  uuid,
        created_at   timestamptz NOT NULL DEFAULT now(),
        ready_at     timestamptz,
        UNIQUE (document_id, version_no)
      )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP SCHEMA document CASCADE`);
  }
}
