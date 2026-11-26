import { api, Page, Role } from './client';
import { downloadFromApi, MiB, putWithProgress } from './transfer';

/**
 * Kho tài liệu (UC5): kiểu dữ liệu và lời gọi API theo hợp đồng ở UC5 spec 9.2. Nhân viên chỉ thấy tài liệu trong phạm vi;
 * HR quản lý ở `/documents/manage` (chỉ metadata, DR-03).
 */

export type DocumentType = 'POLICY' | 'PROCESS' | 'GUIDE' | 'FORM' | 'NOTICE';
export const DOCUMENT_TYPES: DocumentType[] = ['POLICY', 'PROCESS', 'GUIDE', 'FORM', 'NOTICE'];
export const TYPE_LABEL: Record<DocumentType, string> = {
  POLICY: 'Chính sách',
  PROCESS: 'Quy trình',
  GUIDE: 'Hướng dẫn',
  FORM: 'Biểu mẫu',
  NOTICE: 'Thông báo',
};

/** Nhãn vai trò trên form phạm vi; `MANAGER` là người có cấp dưới trực tiếp, không phải trưởng đơn vị (UC5 D4). */
export const SCOPE_ROLES: { role: Role; label: string; hint?: string }[] = [
  { role: 'EMPLOYEE', label: 'Nhân viên', hint: 'mọi người có hồ sơ đang làm việc' },
  { role: 'MANAGER', label: 'Quản lý', hint: 'người có cấp dưới trực tiếp' },
  { role: 'HR', label: 'HR' },
  { role: 'ADMIN', label: 'Quản trị' },
];

export type VersionStatus = 'PENDING' | 'READY' | 'REJECTED';

export interface DocVersion {
  id: string;
  versionNo: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: VersionStatus;
  createdAt: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  type: DocumentType;
  updatedAt: string;
  latest: DocVersion | null;
  versions?: DocVersion[];
}

export interface DocumentScope {
  all: boolean;
  departmentIds: string[];
  roles: Role[];
}

export interface DocumentAdmin extends DocumentItem {
  hidden: boolean;
  version: number;
  versions: DocVersion[];
  scope: DocumentScope & { departments: { id: string; name: string; active: boolean }[] };
}

export interface UploadTicket {
  versionId: string;
  versionNo: number;
  url: string;
  headers: Record<string, string>;
}

export type ManageState = 'VISIBLE' | 'HIDDEN' | 'NOT_READY';

const query = (params: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '') as [string, string][]).toString();

export const documentsApi = {
  list: (p: { type?: DocumentType; q?: string; page: number; size: number }) => api<Page<DocumentItem>>(`/documents?${query(p)}`),
  get: (id: string) => api<DocumentItem>(`/documents/${id}`),
  manageList: (p: { type?: DocumentType; q?: string; state?: ManageState; page: number; size: number }) =>
    api<Page<DocumentAdmin>>(`/documents/manage?${query(p)}`),
  manageGet: (id: string) => api<DocumentAdmin>(`/documents/manage/${id}`),
  create: (body: { title: string; type: DocumentType; scope: DocumentScope } & FileSpec) =>
    api<{ document: DocumentAdmin; upload: UploadTicket }>('/documents', { method: 'POST', body: JSON.stringify(body) }),
  addVersion: (id: string, file: FileSpec) => api<UploadTicket>(`/documents/${id}/versions`, { method: 'POST', body: JSON.stringify(file) }),
  confirm: (id: string, versionId: string) => api<DocumentAdmin>(`/documents/${id}/versions/${versionId}/confirm`, { method: 'POST' }),
  update: (id: string, body: { version: number; title?: string; type?: DocumentType; scope?: DocumentScope }) =>
    api<DocumentAdmin>(`/documents/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  setHidden: (id: string, hidden: boolean) => api<DocumentAdmin>(`/documents/${id}/${hidden ? 'hide' : 'restore'}`, { method: 'POST' }),
  /** Tải qua API (DR-06): không có `versionId` là bản mới nhất. */
  download: (id: string, v: Pick<DocVersion, 'id' | 'fileName'>, latest = false) =>
    downloadFromApi(latest ? `/documents/${id}/download` : `/documents/${id}/versions/${v.id}/download`, v.fileName),
};

// ----- File tải lên (DR-01) -----

export const MAX_DOCUMENT_BYTES = 20 * MiB;
const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export interface FileSpec {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

/** Kiểm đuôi và dung lượng ngay ở trình duyệt; server vẫn kiểm lại, kể cả nội dung thật của file khi xác nhận. */
export function fileSpecOf(file: File): FileSpec | string {
  const contentType = CONTENT_TYPES[file.name.toLowerCase().split('.').pop() ?? ''];
  if (!contentType) return 'Chỉ nhận file PDF hoặc DOCX';
  if (file.size < 1 || file.size > MAX_DOCUMENT_BYTES) return 'File phải từ 1 byte đến 20 MiB';
  return { fileName: file.name, contentType, sizeBytes: file.size };
}

/** PUT file theo URL nhận được rồi xác nhận; phiên bản thành `READY` hoặc API trả 400 nếu file sai (E3b). */
export async function uploadAndConfirm(documentId: string, ticket: UploadTicket, file: File, onProgress: (p: number) => void) {
  try {
    await putWithProgress(ticket.url, ticket.headers, file, onProgress);
  } catch {
    // URL hết hạn sau 10 phút hoặc mất kết nối (E8): phiên bản này bỏ lại ở PENDING, lần sau tạo phiên bản mới.
    throw new Error('Tải lên không thành công. Hãy thử lại.');
  }
  return documentsApi.confirm(documentId, ticket.versionId);
}

/** Nhãn loại file cho biểu tượng ở danh sách. */
export function fileKind(v: DocVersion | null): 'PDF' | 'DOCX' | null {
  if (!v) return null;
  return v.fileName.toLowerCase().endsWith('.docx') ? 'DOCX' : 'PDF';
}
