/**
 * Quy tắc kho tài liệu viết thành hàm thuần để test (docs/business/document-rules.md).
 */
import { Role } from '../identity/roles';

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // DR-01: tối đa 20 MiB

export const FILE_KINDS = {
  pdf: { contentType: 'application/pdf', magic: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // "%PDF-"
  docx: {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    magic: [0x50, 0x4b, 0x03, 0x04], // ZIP; DOCX là gói ZIP có word/document.xml
  },
} as const;
export type FileKind = keyof typeof FILE_KINDS;

/** DR-01: chỉ PDF/DOCX theo phần mở rộng và content type khai báo; dung lượng 1 byte – 20 MiB. Trả lỗi hoặc null. */
export function checkDeclaredFile(fileName: string, contentType: string, sizeBytes: number): string | null {
  const kind = kindOf(fileName);
  if (!kind) return 'Chỉ nhận file PDF hoặc DOCX';
  if (FILE_KINDS[kind].contentType !== contentType) return 'Loại file không khớp phần mở rộng';
  if (sizeBytes < 1 || sizeBytes > MAX_FILE_BYTES) return 'File phải từ 1 byte đến 20 MiB';
  return null;
}

export function kindOf(fileName: string): FileKind | null {
  const ext = fileName.toLowerCase().split('.').pop();
  return ext === 'pdf' || ext === 'docx' ? ext : null;
}

/**
 * DR-01: định dạng thực của file phải khớp phần mở rộng. Kiểm vài byte đầu (magic number); với DOCX kiểm thêm trong
 * phần đầu của gói ZIP có tên mục `word/` (file ZIP đổi tên thành .docx sẽ bị từ chối).
 */
export function matchesContent(fileName: string, head: Uint8Array): boolean {
  const kind = kindOf(fileName);
  if (!kind) return false;
  const magic = FILE_KINDS[kind].magic;
  if (head.length < magic.length || magic.some((b, i) => head[i] !== b)) return false;
  if (kind === 'docx') return Buffer.from(head).includes('word/') || Buffer.from(head).includes('[Content_Types].xml');
  return true;
}

/** Người xem: tính lại mỗi lần từ phòng ban và vai trò hiện tại (DR-06). */
export interface Viewer {
  active: boolean;
  /** Phòng ban của người xem và các phòng ban cha. */
  departmentChain: string[];
  roles: Role[];
}

export interface DocumentScopeSpec {
  scopeAll: boolean;
  departments: string[];
  roles: string[];
}

/** DR-02: khớp bất kỳ phạm vi nào là được xem; người đã nghỉ việc hoặc chưa gắn hồ sơ thì không. */
export function canView(viewer: Viewer, doc: DocumentScopeSpec & { hidden: boolean }): boolean {
  if (!viewer.active || doc.hidden) return false;
  if (doc.scopeAll) return true;
  if (doc.departments.some((d) => viewer.departmentChain.includes(d))) return true;
  return doc.roles.some((r) => viewer.roles.includes(r as Role));
}
