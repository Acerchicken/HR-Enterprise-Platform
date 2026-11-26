import { RAG_SETTINGS } from '../rag/settings';
import { Section } from './extract';

/**
 * Chia mục thành đoạn khoảng `chunkChars` ký tự, chồng `overlapChars` ký tự (ADR-16 mục 3). Đoạn không vượt qua ranh giới
 * mục, để trích dẫn ghi đúng mục, điều; đoạn văn quá dài thì cắt theo câu, rồi theo từ.
 */
export interface Chunk {
  ord: number;
  heading: string;
  content: string;
}

export function chunkSections(sections: Section[], size: number = RAG_SETTINGS.chunkChars, overlap: number = RAG_SETTINGS.overlapChars): Chunk[] {
  const out: Chunk[] = [];
  for (const s of sections) {
    const pieces = s.paragraphs.flatMap((p) => splitLong(p, size));
    let buf = '';
    for (const piece of pieces) {
      if (buf && buf.length + 1 + piece.length > size) {
        out.push({ ord: out.length, heading: s.heading, content: buf });
        // Đoạn sau mở đầu bằng phần cuối đoạn trước; không đủ chỗ thì bỏ phần chồng.
        buf = tail(buf, overlap);
        if (buf.length + 1 + piece.length > size) buf = '';
      }
      buf = buf ? `${buf}\n${piece}` : piece;
    }
    if (buf.trim()) out.push({ ord: out.length, heading: s.heading, content: buf });
  }
  return out;
}

/** Cắt đoạn văn dài hơn `size` theo câu; câu vẫn quá dài thì theo từ. */
function splitLong(p: string, size: number): string[] {
  if (p.length <= size) return [p];
  const sentences = p.match(/[^.!?;]+[.!?;]*\s*/g) ?? [p];
  const out: string[] = [];
  let cur = '';
  for (const raw of sentences) {
    const s = raw.trim();
    if (s.length > size) {
      if (cur) out.push(cur);
      cur = '';
      out.push(...byWords(s, size));
      continue;
    }
    if (cur && cur.length + 1 + s.length > size) {
      out.push(cur);
      cur = s;
    } else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) out.push(cur);
  return out;
}

function byWords(s: string, size: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of s.split(/\s+/)) {
    if (cur && cur.length + 1 + w.length > size) {
      out.push(cur);
      cur = '';
    }
    cur = cur ? `${cur} ${w}` : w.slice(0, size);
  }
  if (cur) out.push(cur);
  return out;
}

/** Phần cuối khoảng `n` ký tự, bắt đầu ở đầu một từ. */
function tail(s: string, n: number): string {
  if (n <= 0 || s.length <= n) return n <= 0 ? '' : s;
  const cut = s.slice(-n);
  const sp = cut.search(/\s/);
  return sp >= 0 ? cut.slice(sp + 1) : cut;
}
