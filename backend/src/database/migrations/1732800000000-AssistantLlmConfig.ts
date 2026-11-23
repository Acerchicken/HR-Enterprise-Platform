import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UC6 FR-6.4 (ADR-16 mục 7): cấu hình nhà cung cấp LLM do ADMIN chọn trên `/admin/assistant`.
 *
 * - Một dòng duy nhất (`id = 1`): nhà cung cấp, model, base URL, khóa API đã mã hóa AES-256-GCM bằng `ASSISTANT_CONFIG_KEY`
 *   (chỉ assistant service giữ khóa này, ADR-08), 4 ký tự cuối để hiển thị, bật/tắt, `version` chống ghi đè (409).
 * - `updated_by` là id tài khoản (iam) của ADMIN; không khóa ngoại vì schema `assistant` không phụ thuộc schema khác.
 */
export class AssistantLlmConfig1732800000000 implements MigrationInterface {
  name = 'AssistantLlmConfig1732800000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE assistant.llm_config (
        id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        provider varchar(30) NOT NULL,
        model varchar(100) NOT NULL,
        base_url text,
        api_key_ciphertext text NOT NULL,
        api_key_last4 varchar(4) NOT NULL,
        enabled boolean NOT NULL DEFAULT true,
        version int NOT NULL DEFAULT 1,
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON assistant.llm_config TO assistant_svc`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE assistant.llm_config`);
  }
}
