/**
 * Tải sẵn model EmbeddingGemma vào ASSISTANT_MODEL_DIR lúc build image (Dockerfile), để service chạy không cần mạng tới
 * Hugging Face (ADR-16 mục 4). Kho model yêu cầu chấp nhận điều khoản Gemma thì đặt HF_TOKEN khi build.
 */
import { GEMMA_DTYPE, GEMMA_REPO } from '../rag/embedders/embeddinggemma';

async function main() {
  const { AutoTokenizer, AutoModel, env } = await import('@huggingface/transformers');
  env.cacheDir = process.env.ASSISTANT_MODEL_DIR || `${process.cwd()}/.model-cache`;
  env.allowRemoteModels = true;
  await AutoTokenizer.from_pretrained(GEMMA_REPO);
  await AutoModel.from_pretrained(GEMMA_REPO, { dtype: GEMMA_DTYPE as any, device: 'cpu' });
  console.log(`Đã tải ${GEMMA_REPO} (${GEMMA_DTYPE}) vào ${env.cacheDir}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
