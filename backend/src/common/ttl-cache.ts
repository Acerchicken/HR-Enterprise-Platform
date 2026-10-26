/**
 * Cache in-memory kiểu cache-aside cho dữ liệu tham chiếu (phòng ban, chức danh).
 * Theo quyết định tuần 6: TTL 10 phút, xóa cache khi có cập nhật, không dùng Redis ở MVP.
 */
export class TtlCache<V> {
  private readonly store = new Map<string, { value: V; expiresAt: number }>();

  constructor(private readonly ttlMs: number, private readonly now: () => number = Date.now) {}

  async getOrLoad(key: string, loader: () => Promise<V>): Promise<V> {
    const hit = this.store.get(key);
    if (hit && hit.expiresAt > this.now()) return hit.value;
    const value = await loader();
    this.store.set(key, { value, expiresAt: this.now() + this.ttlMs });
    return value;
  }

  clear() {
    this.store.clear();
  }
}
