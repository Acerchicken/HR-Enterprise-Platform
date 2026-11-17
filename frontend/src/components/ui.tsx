import { Eye, EyeOff } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { ApiError } from '../api/client';

/** Chữ cái đầu của họ và tên (ảnh đại diện chưa có, FR-1.10). "Nguyễn Văn An" → "VA". */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const pick = parts.length === 1 ? [parts[0]] : parts.slice(-2);
  return pick.map((p) => p[0]!.toUpperCase()).join('');
}

/** Tên gọi trong lời chào: chữ cuối của họ tên ("Nguyễn Văn An" → "An"). */
export function givenName(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/);
  return parts[parts.length - 1] ?? '';
}

export function Avatar({ name, size = 'sm', src }: { name: string | null | undefined; size?: 'sm' | 'md' | 'lg'; src?: string | null }) {
  if (src) return <img className={`avatar avatar-${size}`} src={src} alt={`Ảnh đại diện ${name ?? ''}`} />;
  return (
    <span className={`avatar avatar-${size}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

/** Nhãn "Chưa có" đi kèm chữ đỏ, để không dùng màu làm tín hiệu duy nhất (frontend.md 5.1). */
export function TodoBadge() {
  return <span className="chua">Chưa có</span>;
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Đang tải">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="skeleton-line" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

/** Lỗi theo mã HTTP (frontend.md mục 6): 403 và 404 hiện giống nhau. */
export function errorText(error: Error): string {
  if (error instanceof ApiError) {
    if (error.status === 403 || error.status === 404) return 'Không tìm thấy hoặc bạn không có quyền xem.';
    if (error.status === 409) return 'Dữ liệu vừa được người khác thay đổi. Hãy tải lại.';
    if (error.status === 503) return 'Tạm thời không dùng được.';
    if (error.status >= 500) return `Có lỗi xảy ra${error.traceId ? ` (traceId: ${error.traceId})` : ''}.`;
  }
  return error.message;
}

/**
 * Giá trị nhạy cảm: hiện `********` và nút mắt; chỉ khi bấm mới gọi API (mỗi lần gọi có audit phía server, AC-1.8.8).
 */
export function MaskedValue({
  label,
  hasValue,
  load,
  format = (v) => v,
}: {
  label: string;
  hasValue?: boolean;
  load: () => Promise<string | null>;
  format?: (v: string) => string;
}) {
  const [value, setValue] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const shown = value !== undefined;

  async function toggle() {
    if (shown) return setValue(undefined);
    setBusy(true);
    setError(null);
    try {
      setValue(await load());
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  if (hasValue === false) return <span className="muted">Chưa có dữ liệu</span>;
  return (
    <span className="masked">
      <button type="button" className="eye" onClick={toggle} disabled={busy} aria-label={shown ? `Ẩn ${label}` : `Hiện ${label}`}>
        {shown ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
      <span className={shown ? '' : 'mask'}>{shown ? (value ? format(value) : '—') : '********'}</span>
      {error && <span className="error small"> {errorText(error)}</span>}
    </span>
  );
}

export const formatMoney = (v: string) => `${Number(v).toLocaleString('vi-VN')} ₫`;

/** Ngày ISO → dd/mm/yyyy (frontend.md mục 7). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Sau lỗi 429, khóa nút gửi tới hết thời gian `Retry-After` (frontend.md mục 6, AC-0.5.1). Trả số giây còn lại, 0 là đã mở.
 */
export function useCooldown(error: Error | null): number {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!(error instanceof ApiError) || error.status !== 429) return;
    const until = Date.now() + (error.retryAfter ?? 60) * 1000;
    const tick = () => setLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [error]);
  return left;
}
