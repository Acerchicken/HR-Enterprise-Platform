import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UC6 (ADR-15, ADR-16): schema `assistant` của assistant service. Migration nằm ở đây vì chỉ user migration (chủ database,
 * `rds_superuser` trên RDS) tạo được extension và role; service chỉ đọc, ghi bảng của mình bằng user `assistant_svc`.
 *
 * - `document`: bản sao metadata, phạm vi xem của tài liệu UC5, ghi đè theo event (assistant không đọc schema `document`).
 * - `chunk`: đoạn văn bản của phiên bản `READY` mới nhất, `tsv` full-text (`simple` + `unaccent`, tính lúc ghi).
 * - `chunk_embedding`: vector theo model, cột `vector` không cố định số chiều; mỗi model một chỉ mục HNSW riêng trên biểu
 *   thức ép kiểu (ADR-16 mục 2, 4). Thêm model mới = một migration tạo chỉ mục như `ix_chunk_embedding_gemma`.
 * - `processed_event`: chống xử lý trùng event (queue giao ít nhất một lần).
 *
 * Role `assistant_svc` tạo ở dạng NOLOGIN; staging đặt mật khẩu ngoài migration:
 *   ALTER ROLE assistant_svc LOGIN PASSWORD '<từ Secrets Manager>';
 */
export class AssistantSchema1732700000000 implements MigrationInterface {
  name = 'AssistantSchema1732700000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await q.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);
    await q.query(`CREATE SCHEMA assistant`);

    await q.query(`
      CREATE TABLE assistant.document (
        id uuid PRIMARY KEY,
        title text NOT NULL DEFAULT '',
        type varchar(20) NOT NULL DEFAULT '',
        version_id uuid,
        version_no int,
        hidden boolean NOT NULL DEFAULT false,
        scope_all boolean NOT NULL DEFAULT false,
        scope_department_ids uuid[] NOT NULL DEFAULT '{}',
        scope_roles text[] NOT NULL DEFAULT '{}',
        index_status varchar(10) NOT NULL DEFAULT 'PENDING' CHECK (index_status IN ('PENDING', 'INDEXED', 'FAILED')),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);

    await q.query(`
      CREATE TABLE assistant.chunk (
        id bigserial PRIMARY KEY,
        document_id uuid NOT NULL REFERENCES assistant.document (id) ON DELETE CASCADE,
        version_id uuid NOT NULL,
        ord int NOT NULL,
        heading text NOT NULL DEFAULT '',
        content text NOT NULL,
        tsv tsvector NOT NULL,
        UNIQUE (document_id, ord)
      )`);
    await q.query(`CREATE INDEX ix_chunk_tsv ON assistant.chunk USING gin (tsv)`);

    await q.query(`
      CREATE TABLE assistant.chunk_embedding (
        chunk_id bigint NOT NULL REFERENCES assistant.chunk (id) ON DELETE CASCADE,
        model varchar(64) NOT NULL,
        embedding vector NOT NULL,
        PRIMARY KEY (chunk_id, model)
      )`);
    await q.query(`
      CREATE INDEX ix_chunk_embedding_gemma ON assistant.chunk_embedding
        USING hnsw ((embedding::vector(768)) vector_cosine_ops) WHERE model = 'embeddinggemma-300m'`);

    await q.query(`
      CREATE TABLE assistant.processed_event (
        event_id varchar(64) PRIMARY KEY,
        event_type varchar(50) NOT NULL,
        processed_at timestamptz NOT NULL DEFAULT now()
      )`);

    await q.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'assistant_svc') THEN
          CREATE ROLE assistant_svc NOLOGIN;
        END IF;
      END $$`);
    await q.query(`GRANT USAGE ON SCHEMA assistant TO assistant_svc`);
    await q.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA assistant TO assistant_svc`);
    await q.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA assistant TO assistant_svc`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP SCHEMA assistant CASCADE`);
    // Giữ role và extension: có thể đang được dùng ở nơi khác; xóa tay nếu cần.
  }
}
