/** Ký tự vô hình, điều khiển (zero-width, đổi hướng chữ…): bỏ trước khi index và trước khi gửi LLM (ADR-16 mục 11, G3). */
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F­​-‏‪-‮⁠-⁤﻿]/g;

export function cleanText(s: string): string {
  return s.normalize('NFC').replace(INVISIBLE, '').replace(/[ \t ]+/g, ' ').trim();
}

/** Dòng mở đầu một điều khoản trong văn bản quy định ("Điều 5.", "Chương II", "Mục 3"): dùng làm tiêu đề để trích dẫn. */
const CLAUSE = /^(chuong|muc|dieu|phan)\s+([0-9]+|[ivxlc]+)\b/i;

/** So khớp cả bản mất dấu ("Dieu 5"), hay gặp ở PDF xuất từ font cũ. */
export const looksLikeHeading = (line: string) => line.length <= 160 && CLAUSE.test(stripAccents(line));

export const stripAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
