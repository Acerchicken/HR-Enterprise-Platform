import { Passage } from '../llm/prompt';

/**
 * Trích dẫn qua prompt (ADR-16 mục 6): đọc các số `[n]` trong câu trả lời, bỏ số không có trong danh sách đoạn đã gửi
 * (xóa khỏi câu trả lời luôn để người đọc không thấy số lạ). Không còn số hợp lệ nào thì trả `citations` rỗng (A5).
 */
export interface Citation {
  n: number;
  documentId: string;
  versionNo: number;
  title: string;
  section: string;
  citedText: string;
}

const MARK = /\[(\d{1,3})\]/g;
const CITED_CHARS = 200;

export function extractCitations(answer: string, passages: Passage[]): { answer: string; citations: Citation[] } {
  const byN = new Map(passages.map((p) => [p.n, p]));
  const used = new Set<number>();
  const cleaned = answer
    .replace(MARK, (m, d: string) => {
      const n = Number(d);
      if (!byN.has(n)) return '';
      used.add(n);
      return m;
    })
    .replace(/[ \t]+([.,;:!?])/g, '$1')
    .trim();
  const citations = [...used]
    .sort((a, b) => a - b)
    .map((n) => {
      const p = byN.get(n)!;
      return {
        n,
        documentId: p.documentId,
        versionNo: p.versionNo,
        title: p.title,
        section: p.section,
        citedText: p.content.length > CITED_CHARS ? `${p.content.slice(0, CITED_CHARS).trimEnd()}…` : p.content,
      };
    });
  return { answer: cleaned, citations };
}
