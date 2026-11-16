import { Download, FileText, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError, BASE_URL } from '../api/client';
import { getToken } from '../auth/auth';
import { errorText } from './ui';

export interface FileView {
  id: string;
  section: string;
  itemId: string | null;
  name: string;
  contentType: string;
  size: number;
  status: 'PENDING' | 'PENDING_REVIEW' | 'READY' | 'REJECTED' | 'DELETED';
  uploadedByHr: boolean;
  createdAt: string;
}

const MiB = 1024 * 1024;
const TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

export const formatSize = (n: number) => (n >= MiB ? `${(n / MiB).toFixed(1)} MiB` : `${Math.max(1, Math.round(n / 1024))} KiB`);

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function putWithProgress(url: string, headers: Record<string, string>, file: File, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Tải file lên storage thất bại')));
    xhr.onerror = () => reject(new Error('Không kết nối được storage'));
    xhr.send(file);
  });
}

/**
 * Chọn file, kiểm loại và dung lượng ở trình duyệt, tính SHA-256, xin URL, PUT thẳng lên storage có thanh tiến độ, rồi xác nhận
 * (UC1 luồng 4.3). Trả file đã xác nhận cho nơi gọi (để gắn vào yêu cầu cập nhật).
 */
export function FileUpload({
  employeeId,
  section,
  itemId,
  images = false,
  label = 'Tải lên',
  onUploaded,
}: {
  employeeId: string;
  section: string;
  itemId?: string | null;
  images?: boolean;
  label?: string;
  onUploaded: (f: FileView) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const max = images ? 2 * MiB : 10 * MiB;
  const accept = images ? '.jpg,.jpeg,.png' : '.pdf,.docx,.jpg,.jpeg,.png';

  async function pick(file: File) {
    setError(null);
    const ext = file.name.toLowerCase().split('.').pop() ?? '';
    const type = TYPES[ext];
    if (!type || (images && !type.startsWith('image/'))) return setError(images ? 'Chỉ nhận ảnh JPG, PNG' : 'Chỉ nhận PDF, DOCX, JPG, PNG');
    if (file.size < 1 || file.size > max) return setError(`File tối đa ${max / MiB} MiB`);
    try {
      setProgress(0);
      const sha256 = await sha256Hex(file);
      const r = await api<{ file: FileView; existing: boolean; upload?: { url: string; headers: Record<string, string> } }>(
        `/employees/${employeeId}/files`,
        { method: 'POST', body: JSON.stringify({ section, itemId, fileName: file.name, contentType: type, size: file.size, sha256 }) },
      );
      if (r.existing) {
        onUploaded(r.file);
        return;
      }
      await putWithProgress(r.upload!.url, r.upload!.headers, file, setProgress);
      onUploaded(await api<FileView>(`/employees/${employeeId}/files/${r.file.id}/confirm`, { method: 'POST' }));
    } catch (e) {
      setError(e instanceof ApiError && [400, 409, 429].includes(e.status) ? e.message : errorText(e as Error));
    } finally {
      setProgress(null);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <span className="file-upload">
      <input ref={input} type="file" accept={accept} hidden onChange={(e) => e.target.files?.[0] && void pick(e.target.files[0])} />
      <button type="button" disabled={progress !== null} onClick={() => input.current?.click()}>
        <Upload size={16} /> {progress !== null ? `Đang tải ${progress}%` : label}
      </button>
      {progress !== null && <progress max={100} value={progress} aria-label="Tiến độ tải lên" />}
      {error && <span className="error small">{error}</span>}
    </span>
  );
}

/** Tải file qua API (có token), lưu bằng link tạm của trình duyệt; không bao giờ mở link storage. */
export async function downloadFile(employeeId: string, f: { id: string; name: string }) {
  const res = await fetch(`${BASE_URL}/employees/${employeeId}/files/${f.id}/download`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new Error(res.status === 404 ? 'Không tìm thấy file' : res.status === 429 ? 'Bạn tải quá nhiều file, thử lại sau' : 'Không tải được file');
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = f.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const STATUS: Record<string, string> = { PENDING_REVIEW: 'Chờ HR duyệt', DELETED: 'Đã xóa', REJECTED: 'Bị từ chối' };

export function FileList({ employeeId, files, onRemove }: { employeeId: string; files: FileView[]; onRemove?: (f: FileView) => void }) {
  const [error, setError] = useState<string | null>(null);
  if (!files.length) return null;
  return (
    <ul className="plain files">
      {files.map((f) => (
        <li key={f.id} className="file-row">
          <FileText size={18} aria-hidden="true" />
          <span className="ellipsis">{f.name}</span>
          <span className="muted small">{formatSize(f.size)}</span>
          {STATUS[f.status] && <span className="pend">{STATUS[f.status]}</span>}
          {f.uploadedByHr && <span className="muted small">HR tải lên</span>}
          <button type="button" className="icon-btn" aria-label={`Tải ${f.name}`} onClick={() => downloadFile(employeeId, f).catch((e) => setError(e.message))}>
            <Download size={16} />
          </button>
          {onRemove && f.status === 'READY' && (
            <button type="button" className="link danger small" onClick={() => onRemove(f)}>Xóa</button>
          )}
        </li>
      ))}
      {error && <li className="error small">{error}</li>}
    </ul>
  );
}

/** Ảnh đại diện đã duyệt: tải bằng token (thẻ img không gửi được header), giữ trong bộ nhớ trang. */
const avatarCache = new Map<string, Promise<string | null>>();
export function useAvatarUrl(employeeId: string | null | undefined, hasAvatar: boolean | undefined, bust = 0): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!employeeId || !hasAvatar) return setUrl(null);
    const key = `${employeeId}:${bust}`;
    let p = avatarCache.get(key);
    if (!p) {
      p = fetch(`${BASE_URL}/employees/${employeeId}/avatar`, { headers: { Authorization: `Bearer ${getToken()}` } })
        .then((r) => (r.ok ? r.blob().then((b) => URL.createObjectURL(b)) : null))
        .catch(() => null);
      avatarCache.set(key, p);
    }
    let live = true;
    void p.then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [employeeId, hasAvatar, bust]);
  return url;
}
