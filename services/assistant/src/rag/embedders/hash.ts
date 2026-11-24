import { createHash } from 'crypto';
import { EmbedInput, Embedder, normalize } from './embedder';

/**
 * Embedder băm từ (bag of words, 256 chiều): **chỉ để test và chạy thử không có model**. Không hiểu nghĩa, chỉ đo từ trùng
 * (bỏ dấu), nên câu viết khác chữ sẽ không khớp. Không có chỉ mục HNSW, truy vấn quét tuần tự.
 */
export class HashEmbedder implements Embedder {
  readonly id: string;

  constructor(readonly dimensions = 256) {
    this.id = `hash-${dimensions}`;
  }

  async load(): Promise<void> {}

  async embedQuery(question: string): Promise<number[]> {
    return this.vec(question);
  }

  async embedDocuments(docs: EmbedInput[]): Promise<number[][]> {
    return docs.map((d) => this.vec(`${d.heading} ${d.text}`));
  }

  private vec(text: string): number[] {
    const v = new Array<number>(this.dimensions).fill(0);
    const words = text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .toLowerCase()
      .match(/[a-z0-9]+/g) ?? [];
    for (const w of words) {
      const h = createHash('md5').update(w).digest();
      v[h.readUInt32BE(0) % this.dimensions] += 1;
    }
    return normalize(v);
  }
}
