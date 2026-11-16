/**
 * Quy tắc file hồ sơ (UC1 FR-1.10, spec mục 7 "Tệp đính kèm"), viết thành hàm thuần để test.
 */
export const MiB = 1024 * 1024;
export const MAX_FILE_BYTES = 10 * MiB;
export const MAX_AVATAR_BYTES = 2 * MiB;
/** Hạn mức mỗi người (AC-1.10.8). */
export const MAX_READY_FILES = 50;
export const MAX_TOTAL_BYTES = 200 * MiB;
/** File không gắn vào yêu cầu nào sau 24 giờ thì bị xóa (spec 4.3 bước 10). */
export const ORPHAN_HOURS = 24;

const KINDS = {
  pdf: { types: ['application/pdf'], magic: [[0x25, 0x50, 0x44, 0x46, 0x2d]] },
  docx: { types: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], magic: [[0x50, 0x4b, 0x03, 0x04]] },
  jpg: { types: ['image/jpeg'], magic: [[0xff, 0xd8, 0xff]] },
  jpeg: { types: ['image/jpeg'], magic: [[0xff, 0xd8, 0xff]] },
  png: { types: ['image/png'], magic: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
} as const;
type Kind = keyof typeof KINDS;

/**
 * Mục nhận file và ai tải lên được. `item`: file gắn vào một dòng của mục (bằng cấp, giấy tờ người phụ thuộc).
 * `maxFiles`: số file đang dùng tối đa trong mục.
 */
export const FILE_SECTIONS: Record<string, { by: 'NV' | 'HR'; item: boolean; maxFiles: number; images?: boolean }> = {
  cv: { by: 'NV', item: false, maxFiles: 5 },
  avatar: { by: 'NV', item: false, maxFiles: 1, images: true },
  qualifications: { by: 'NV', item: true, maxFiles: 50 },
  relatives: { by: 'NV', item: true, maxFiles: 50 },
};

const extOf = (name: string) => name.toLowerCase().split('.').pop() ?? '';

/** Kiểm khai báo trước khi phát URL tải lên: loại, đuôi, dung lượng. Trả lỗi hoặc null. */
export function checkDeclared(section: string, fileName: string, contentType: string, size: number): string | null {
  const conf = FILE_SECTIONS[section];
  if (!conf) return 'Mục này không nhận file';
  const ext = extOf(fileName) as Kind;
  const kind = KINDS[ext];
  if (!kind || (conf.images && ext !== 'jpg' && ext !== 'jpeg' && ext !== 'png')) {
    return conf.images ? 'Ảnh đại diện chỉ nhận JPG, PNG' : 'Chỉ nhận file PDF, DOCX, JPG, PNG';
  }
  if (!(kind.types as readonly string[]).includes(contentType)) return 'Loại file không khớp phần mở rộng';
  const max = conf.images ? MAX_AVATAR_BYTES : MAX_FILE_BYTES;
  if (!Number.isInteger(size) || size < 1 || size > max) return `File phải từ 1 byte đến ${max / MiB} MiB`;
  return null;
}

/**
 * NFR-5.23: nội dung thật phải khớp đuôi file (ZIP đổi đuôi `.pdf`, `.exe` đổi đuôi `.jpg` bị từ chối). DOCX là gói ZIP có
 * mục `word/` hoặc `[Content_Types].xml`.
 */
export function matchesContent(fileName: string, head: Uint8Array): boolean {
  const ext = extOf(fileName) as Kind;
  const kind = KINDS[ext];
  if (!kind) return false;
  const ok = kind.magic.some((m) => head.length >= m.length && m.every((b, i) => head[i] === b));
  if (!ok) return false;
  if (ext === 'docx') return Buffer.from(head).includes('word/') || Buffer.from(head).includes('[Content_Types].xml');
  return true;
}

/** Hạn mức file đang dùng của một người (AC-1.10.8). Trả lỗi hoặc null. */
export function checkQuota(readyCount: number, readyBytes: number, newSize: number): string | null {
  if (readyCount >= MAX_READY_FILES) return `Mỗi người tối đa ${MAX_READY_FILES} file`;
  if (readyBytes + newSize > MAX_TOTAL_BYTES) return `Tổng dung lượng file mỗi người tối đa ${MAX_TOTAL_BYTES / MiB} MiB`;
  return null;
}

export const SHA256 = /^[0-9a-f]{64}$/;
