import mammoth from 'mammoth';
import { cleanText, looksLikeHeading } from './text';

/**
 * Trích văn bản PDF (theo trang) và DOCX (theo đoạn, tiêu đề) thành các mục có tiêu đề để trích dẫn (UC6 spec 13.2).
 * Không chạy macro, không render: PDF đọc bằng pdf.js với `isEvalSupported = false`.
 */
export interface Section {
  /** Mục, điều hoặc trang, hiện trong trích dẫn ("Điều 5. Nghỉ việc riêng (trang 3)"). */
  heading: string;
  paragraphs: string[];
}

export const PDF = 'application/pdf';
export const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export class ExtractError extends Error {}

export async function extractSections(file: Buffer, contentType: string): Promise<Section[]> {
  let sections: Section[];
  try {
    if (contentType === PDF) sections = await extractPdf(file);
    else if (contentType === DOCX) sections = await extractDocx(file);
    else throw new ExtractError(`Không hỗ trợ định dạng ${contentType}`);
  } catch (e) {
    if (e instanceof ExtractError) throw e;
    throw new ExtractError(`Không đọc được file: ${e instanceof Error ? e.message : e}`);
  }
  const nonEmpty = sections.filter((s) => s.paragraphs.length);
  if (!nonEmpty.length) throw new ExtractError('File không có chữ (có thể là bản scan)');
  return nonEmpty;
}

/** Gom đoạn thành mục: gặp dòng giống tiêu đề thì mở mục mới. `suffix` thêm vào tiêu đề (số trang của PDF). */
export function toSections(lines: Array<{ text: string; heading?: boolean; suffix?: string; fallback: string }>): Section[] {
  const out: Section[] = [];
  let cur: Section | null = null;
  let curHeading = '';
  for (const l of lines) {
    const text = cleanText(l.text);
    if (!text) continue;
    const isHeading = l.heading || looksLikeHeading(text);
    if (isHeading) curHeading = text;
    // Chưa gặp tiêu đề nào: dùng `fallback` ("Trang 3"), đã chứa số trang nên không thêm `suffix`.
    const heading = curHeading ? curHeading + (l.suffix ?? '') : l.fallback;
    if (!cur || cur.heading !== heading) {
      cur = { heading, paragraphs: [] };
      out.push(cur);
    }
    cur.paragraphs.push(text);
  }
  return out;
}

/**
 * pdf.js chỉ có bản ESM; gọi import() thật (TypeScript commonjs sẽ đổi `import()` thành require).
 * Mã nguồn hàm có thêm chuỗi riêng cho mỗi lần nạp module: V8 lưu bản biên dịch theo mã nguồn, nên hai lần nạp (hai file test
 * của jest) cùng mã sẽ dùng lại bộ nạp import() của lần đầu, đã bị dọn, và báo "Test environment has been torn down".
 */
const esmImport = new Function('s', `return import(s) // ${Date.now()}-${Math.random()}`) as (s: string) => Promise<any>;

async function extractPdf(file: Buffer): Promise<Section[]> {
  const pdfjs = await esmImport('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(file),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  }).promise;
  const lines: Array<{ text: string; suffix: string; fallback: string }> = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      let line = '';
      const flush = () => {
        if (line.trim()) lines.push({ text: line, suffix: ` (trang ${p})`, fallback: `Trang ${p}` });
        line = '';
      };
      for (const item of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
        if (typeof item.str !== 'string') continue;
        line += item.str;
        if (item.hasEOL) flush();
      }
      flush();
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  // PDF ngắt dòng theo bề rộng trang: nối các dòng thường thành đoạn, giữ dòng tiêu đề riêng.
  const merged: typeof lines = [];
  for (const l of lines) {
    const prev = merged[merged.length - 1];
    const text = cleanText(l.text);
    if (prev && prev.suffix === l.suffix && !looksLikeHeading(text) && !looksLikeHeading(cleanText(prev.text)) && !/[.:;!?]$/.test(cleanText(prev.text))) {
      prev.text = `${cleanText(prev.text)} ${text}`;
    } else merged.push({ ...l, text });
  }
  return toSections(merged);
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);

async function extractDocx(file: Buffer): Promise<Section[]> {
  const { value: html } = await mammoth.convertToHtml({ buffer: file });
  const lines: Array<{ text: string; heading: boolean; fallback: string }> = [];
  for (const m of html.matchAll(/<(h[1-6]|p|li|td|th)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
    lines.push({ text: decode(m[2]), heading: m[1].startsWith('h'), fallback: '' });
  }
  return toSections(lines);
}
