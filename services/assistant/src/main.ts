/**
 * Assistant service (UC6, ADR-15, ADR-16):  npm run start:dev (dev) · node dist/main.js (Docker)
 * Nạp model embedding, nghe queue `assistant.document`, phục vụ HTTP nội bộ (`/health`, `POST /internal/answers`,
 * `/internal/config*` cho trang Cấu hình trợ lý).
 */
// Bật OpenTelemetry trước khi nạp http, pg (ADR-15 bước 4).
import './tracing-register';
import { loadConfig } from './config';
import { contextFromTraceparent, inSpan, SpanKind } from './tracing';
import { createPool } from './db';
import { createHttpServer } from './http';
import { Indexer } from './ingest/indexer';
import { errorText, log } from './log';
import { createConsumer } from './messaging/consumer';
import { createEmbedder } from './rag/embedders/registry';
import { S3FileReader } from './storage';
import { Answerer } from './answer/answerer';
import { answerRoute } from './answer/route';
import { configRoutes } from './llm/config-route';
import { DbConfigStore } from './llm/config-store';
import { SecretBox } from './llm/secret-box';
import { Retriever } from './rag/retriever';

async function main() {
  const cfg = loadConfig();
  const pool = createPool(cfg.db);
  const embedder = createEmbedder(cfg.embeddingModel, { cacheDir: cfg.modelCacheDir });
  const started = Date.now();
  await embedder.load();
  log.info('Đã nạp model embedding', { model: embedder.id, dimensions: embedder.dimensions, ms: Date.now() - started });

  const indexer = new Indexer(pool, new S3FileReader(cfg.storage), embedder);
  const consumer = createConsumer(cfg.queue);
  // ADR-15 bước 4: xử lý event là span con của span gửi đi trên API (traceparent trong message).
  await consumer.start((e) =>
    inSpan(
      `process ${e.type}`,
      { kind: SpanKind.CONSUMER, parent: contextFromTraceparent(e.traceparent), attributes: { 'messaging.message.id': e.id, 'hr.event_type': e.type } },
      () => indexer.handle(e),
    ).then(() => undefined),
  );

  const configs = new DbConfigStore(pool, new SecretBox(cfg.configKey));
  const answerer = new Answerer(new Retriever(pool, embedder), configs, cfg.llmTimeoutMs);
  const server = createHttpServer({
    'POST /internal/answers': answerRoute(answerer, cfg.internalToken),
    ...configRoutes(configs, cfg.internalToken, cfg.llmTimeoutMs),
    'GET /health': async () => {
      await pool.query('SELECT 1');
      return { status: 200, body: { status: 'ok', embeddingModel: embedder.id } };
    },
  });
  server.listen(cfg.port, () => log.info('HTTP nội bộ đang nghe', { port: cfg.port }));

  const stop = async () => {
    log.info('Đang dừng');
    server.close();
    await consumer.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

main().catch((e) => {
  log.error('Không khởi động được', { error: errorText(e) });
  process.exit(1);
});
