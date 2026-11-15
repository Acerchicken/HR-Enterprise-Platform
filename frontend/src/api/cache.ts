import { api, ProfileSummary } from './client';

/**
 * Cache ngắn cho `summary`: quay lại trang chính của hồ sơ trong 60 giây không gọi lại API (UC1 spec 4.1 bước 2a).
 * Chỉ giữ trong bộ nhớ, không ghi localStorage (frontend.md mục 6).
 */
const TTL_MS = 60_000;
const store = new Map<string, { at: number; value: Promise<ProfileSummary> }>();

export function getSummary(id: string): Promise<ProfileSummary> {
  const hit = store.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = api<ProfileSummary>(`/employees/${id}/summary`);
  store.set(id, { at: Date.now(), value });
  value.catch(() => store.delete(id));
  return value;
}

/** Gọi sau khi sửa hồ sơ để lần mở sau lấy dữ liệu mới. */
export function invalidateSummary(id: string) {
  store.delete(id);
}
