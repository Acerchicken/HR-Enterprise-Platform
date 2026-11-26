/**
 * Giao diện model embedding (ADR-16 mục 4). Mỗi model một file adapter tự lo tiền tố riêng của nó (sai tiền tố thì kết quả
 * kém đi rõ), đăng ký vào `registry.ts`. Đổi model: `ASSISTANT_EMBEDDING_MODEL` + lệnh `reindex-embeddings`.
 */
export interface EmbedInput {
  /** Mục, điều hoặc tiêu đề tài liệu; rỗng nếu không có. */
  heading: string;
  text: string;
}

export interface Embedder {
  /** Trùng cột `assistant.chunk_embedding.model` và điều kiện của chỉ mục HNSW. */
  readonly id: string;
  readonly dimensions: number;
  /** Nạp model (đọc file đã tải sẵn); gọi một lần lúc khởi động để health chỉ báo sẵn sàng khi model đã nạp. */
  load(): Promise<void>;
  embedQuery(question: string): Promise<number[]>;
  embedDocuments(docs: EmbedInput[]): Promise<number[][]>;
}

/** Chuẩn hóa độ dài 1 (cosine). */
export function normalize(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

/** Dạng chuỗi pgvector: `[0.1,0.2,...]`. */
export const toPgVector = (v: number[]) => `[${v.join(',')}]`;
