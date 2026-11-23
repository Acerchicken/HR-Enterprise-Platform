import { Embedder } from './embedder';
import { EmbeddingGemma } from './embeddinggemma';
import { HashEmbedder } from './hash';

/**
 * Registry model embedding (ADR-16 mục 4). Thêm model = một file adapter cài `Embedder`, một dòng ở đây và một migration
 * tạo chỉ mục HNSW `((embedding::vector(n))) WHERE model = '<id>'` cho số chiều của nó.
 */
const FACTORIES: Record<string, (opts: { cacheDir: string }) => Embedder> = {
  'embeddinggemma-300m': ({ cacheDir }) => new EmbeddingGemma(cacheDir),
  'hash-256': () => new HashEmbedder(256),
};

export const EMBEDDER_IDS = Object.keys(FACTORIES);

export function createEmbedder(id: string, opts: { cacheDir: string }): Embedder {
  const make = FACTORIES[id];
  if (!make) throw new Error(`ASSISTANT_EMBEDDING_MODEL không có trong registry: ${id} (có: ${EMBEDDER_IDS.join(', ')})`);
  return make(opts);
}

/** Chỉ cho test: thêm embedder giả để chứng minh mở rộng được bằng một dòng đăng ký. */
export function registerEmbedder(id: string, make: (opts: { cacheDir: string }) => Embedder): void {
  FACTORIES[id] = make;
  if (!EMBEDDER_IDS.includes(id)) EMBEDDER_IDS.push(id);
}
