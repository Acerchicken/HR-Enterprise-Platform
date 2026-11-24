import { EmbedInput, Embedder, normalize } from './embedder';

/**
 * EmbeddingGemma 300M của Google (Duong chốt 23/11, ADR-16 mục 4): đa ngôn ngữ, 768 chiều, tối đa 2.048 token.
 * Bản ONNX lượng tử hóa q8 chạy bằng CPU qua `@huggingface/transformers`; file model tải sẵn lúc build image
 * (`npm run download-model`), service chạy với `allowRemoteModels = false` nên không gọi Hugging Face khi chạy.
 *
 * Tiền tố theo hướng dẫn của model cho bài toán tìm kiếm: câu hỏi `task: search result | query: `,
 * đoạn văn `title: {tiêu đề hoặc none} | text: `.
 */
export const GEMMA_REPO = 'onnx-community/embeddinggemma-300m-ONNX';
export const GEMMA_DTYPE = 'q8';
const MAX_TOKENS = 2048;

export class EmbeddingGemma implements Embedder {
  readonly id = 'embeddinggemma-300m';
  readonly dimensions = 768;
  private tokenizer: any = null;
  private model: any = null;

  constructor(private readonly cacheDir: string) {}

  async load(): Promise<void> {
    if (this.model) return;
    const { AutoTokenizer, AutoModel, env } = await import('@huggingface/transformers');
    env.cacheDir = this.cacheDir;
    env.allowRemoteModels = false;
    this.tokenizer = await AutoTokenizer.from_pretrained(GEMMA_REPO);
    this.model = await AutoModel.from_pretrained(GEMMA_REPO, { dtype: GEMMA_DTYPE as any, device: 'cpu' });
  }

  static queryText(question: string): string {
    return `task: search result | query: ${question}`;
  }

  static documentText(d: EmbedInput): string {
    return `title: ${d.heading.trim() || 'none'} | text: ${d.text}`;
  }

  async embedQuery(question: string): Promise<number[]> {
    return (await this.run([EmbeddingGemma.queryText(question)]))[0];
  }

  async embedDocuments(docs: EmbedInput[]): Promise<number[][]> {
    return this.run(docs.map(EmbeddingGemma.documentText));
  }

  private async run(texts: string[]): Promise<number[][]> {
    await this.load();
    const inputs = await this.tokenizer(texts, { padding: true, truncation: true, max_length: MAX_TOKENS });
    const out = await this.model(inputs);
    const emb = out.sentence_embedding;
    const rows: number[][] = emb.tolist();
    return rows.map((r) => normalize(r));
  }
}
