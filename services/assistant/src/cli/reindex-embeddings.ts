/**
 * Tính vector cho mọi đoạn bằng một model embedding (ADR-16 mục 4), ghi song song vector của model cũ nên trợ lý vẫn trả
 * lời trong lúc chạy. Các bước đổi model:
 *   1. npm run reindex-embeddings -- --model <id>                (Docker: node dist/cli/reindex-embeddings.js --model <id>)
 *   2. Đổi ASSISTANT_EMBEDDING_MODEL=<id>, deploy, hỏi thử
 *   3. npm run reindex-embeddings -- --model <id> --delete-others  (xóa vector của các model khác)
 * Model mới cần chỉ mục HNSW riêng (migration), nếu thiếu lệnh vẫn chạy nhưng cảnh báo vì truy vấn sẽ quét tuần tự.
 */
import { loadConfig } from '../config';
import { createPool } from '../db';
import { log } from '../log';
import { toPgVector } from '../rag/embedders/embedder';
import { createEmbedder } from '../rag/embedders/registry';
import { RAG_SETTINGS } from '../rag/settings';
import { Pool } from 'pg';
import { Embedder } from '../rag/embedders/embedder';

export async function reindex(pool: Pool, embedder: Embedder, deleteOthers: boolean): Promise<{ embedded: number; deleted: number }> {
  await embedder.load();
  let embedded = 0;
  for (;;) {
    const { rows } = await pool.query(
      `SELECT c.id, c.heading, c.content, d.title FROM assistant.chunk c JOIN assistant.document d ON d.id = c.document_id
       WHERE NOT EXISTS (SELECT 1 FROM assistant.chunk_embedding e WHERE e.chunk_id = c.id AND e.model = $1)
       ORDER BY c.id LIMIT $2`,
      [embedder.id, RAG_SETTINGS.embedBatch],
    );
    if (!rows.length) break;
    const vectors = await embedder.embedDocuments(rows.map((r) => ({ heading: r.heading || r.title, text: r.content })));
    for (let i = 0; i < rows.length; i++) {
      // Đoạn có thể vừa bị xóa (tài liệu có bản mới): bỏ qua lỗi khóa ngoại bằng cách chỉ chèn khi đoạn còn.
      await pool.query(
        `INSERT INTO assistant.chunk_embedding (chunk_id, model, embedding)
         SELECT $1, $2, $3::vector WHERE EXISTS (SELECT 1 FROM assistant.chunk WHERE id = $1) ON CONFLICT DO NOTHING`,
        [rows[i].id, embedder.id, toPgVector(vectors[i])],
      );
    }
    embedded += rows.length;
  }
  const deleted = deleteOthers ? (await pool.query('DELETE FROM assistant.chunk_embedding WHERE model <> $1', [embedder.id])).rowCount ?? 0 : 0;
  return { embedded, deleted };
}

async function main() {
  const args = process.argv.slice(2);
  const model = args[args.indexOf('--model') + 1];
  if (!args.includes('--model') || !model) {
    console.error('Cách dùng: reindex-embeddings --model <id> [--delete-others]');
    process.exit(2);
  }
  const cfg = loadConfig();
  const pool = createPool(cfg.db);
  try {
    const embedder = createEmbedder(model, { cacheDir: cfg.modelCacheDir });
    const { rows } = await pool.query(
      `SELECT 1 FROM pg_indexes WHERE schemaname = 'assistant' AND tablename = 'chunk_embedding' AND indexdef LIKE '%' || $1 || '%'`,
      [`'${model}'`],
    );
    if (!rows.length) log.warn('Chưa có chỉ mục HNSW cho model này: truy vấn vector sẽ quét tuần tự', { model });
    const r = await reindex(pool, embedder, args.includes('--delete-others'));
    console.log(`Đã tính ${r.embedded} vector bằng ${model}; xóa ${r.deleted} vector của model khác.`);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
