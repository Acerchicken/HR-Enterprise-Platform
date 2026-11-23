import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from './audit-catalog';

/** Mọi file .ts (trừ test) dưới `dir`. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'migrations' ? [] : sources(p);
    return name.endsWith('.ts') && !name.endsWith('.spec.ts') ? [p] : [];
  });
}

describe('danh mục audit (UC7 spec mục 2)', () => {
  const code = sources(join(__dirname, '..', '..')).map((f) => readFileSync(f, 'utf8')).join('\n');

  it('mọi `action` ghi trong code đều có trong danh mục (thêm hành động mới thì khai báo ở audit-catalog.ts)', () => {
    const used = new Set<string>();
    // Đoạn ngay sau mỗi lời gọi ghi audit: `audit.record(`, `this.record(` (UC8) và SQL INSERT thẳng (worker, lệnh).
    for (const call of code.matchAll(/audit\.record\(([\s\S]{0,400})/g)) {
      const expr = call[1].match(/action:\s*([^,\n]+)/)?.[1] ?? '';
      for (const m of expr.matchAll(/'([A-Z_]+)'/g)) used.add(m[1]);
    }
    for (const m of code.matchAll(/this\.record\(\w+, \w+, '([A-Z_]+)'/g)) used.add(m[1]);
    for (const m of code.matchAll(/INSERT INTO audit\.audit_log[^`]*VALUES \([^,]+, '([A-Z_]+)'/g)) used.add(m[1]);
    // Bảng ánh xạ thao tác đơn nghỉ → hành động audit (leave.service.ts).
    const map = code.match(/const AUDIT_ACTION[^{]*\{([^}]*)\}/);
    for (const m of map?.[1].matchAll(/'([A-Z_]+)'/g) ?? []) used.add(m[1]);
    const missing = [...used].filter((a) => !(AUDIT_ACTIONS as readonly string[]).includes(a));
    expect(missing).toEqual([]);
  });

  it('mọi `entityType` ghi trong code đều có trong danh mục', () => {
    const used = new Set<string>();
    for (const m of code.matchAll(/entityType:\s*'([a-z_]+)'/g)) used.add(m[1]);
    for (const m of code.matchAll(/INSERT INTO audit\.audit_log[^`]*VALUES \([^,]+, '[A-Z_]+', '([a-z_]+)'/g)) used.add(m[1]);
    const missing = [...used].filter((t) => !(AUDIT_ENTITY_TYPES as readonly string[]).includes(t));
    expect(missing).toEqual([]);
  });
});
