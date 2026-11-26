import { getToken } from '../auth/auth';
import { BASE_URL } from './client';

/**
 * Tải file lên và tải file về, dùng chung cho file hồ sơ (UC1) và kho tài liệu (UC5), ADR-13: file tải lên PUT thẳng lên
 * storage bằng URL có hạn; file tải về luôn đi qua API (có token, kiểm quyền mỗi lần), không bao giờ mở link storage.
 */

export const MiB = 1024 * 1024;

export const formatSize = (n: number) => (n >= MiB ? `${(n / MiB).toFixed(1)} MiB` : `${Math.max(1, Math.round(n / 1024))} KiB`);

/** PUT file lên URL tải lên, báo tiến độ 0–100. */
export function putWithProgress(url: string, headers: Record<string, string>, file: File, onProgress: (p: number) => void) {
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

/** Lỗi khi tải về theo mã HTTP; 404 không phân biệt "không có" với "không có quyền" (DR-08). */
function downloadError(status: number): string {
  if (status === 404) return 'Không tìm thấy file hoặc bạn không có quyền tải';
  if (status === 429) return 'Bạn tải quá nhiều file, thử lại sau';
  if (status === 503) return 'Kho file tạm thời không dùng được';
  return 'Không tải được file';
}

/** Gọi API tải file (có token) rồi lưu bằng link tạm của trình duyệt. `path` tính từ `/api/v1`. */
export async function downloadFromApi(path: string, fileName: string): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new Error(downloadError(res.status));
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
