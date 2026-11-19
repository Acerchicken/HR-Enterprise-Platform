/**
 * Luật loại đơn vị (ADR-14, UC2 spec mục 7). Không phụ thuộc NestJS để test đơn vị dễ.
 */
export const UNIT_TYPES = ['COMPANY', 'CENTER', 'DEPARTMENT', 'TEAM'] as const;
export type UnitType = (typeof UNIT_TYPES)[number];
export const UNIT_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

/** Loại cha hợp lệ của từng loại; COMPANY không có cha. */
export const ALLOWED_PARENT: Record<UnitType, UnitType[]> = {
  COMPANY: [],
  CENTER: ['COMPANY'],
  DEPARTMENT: ['COMPANY', 'CENTER'],
  TEAM: ['DEPARTMENT'],
};

/** Tên hiển thị của loại, của vai trò trưởng, phó và số phó tối đa. */
export const UNIT_LABEL: Record<UnitType, { name: string; head: string; deputy: string | null; maxDeputies: number }> = {
  COMPANY: { name: 'Công ty', head: 'Tổng Giám đốc', deputy: 'Phó Tổng Giám đốc', maxDeputies: 5 },
  CENTER: { name: 'Trung tâm', head: 'Giám đốc trung tâm', deputy: 'Phó Giám đốc trung tâm', maxDeputies: 3 },
  DEPARTMENT: { name: 'Phòng', head: 'Trưởng phòng', deputy: 'Phó phòng', maxDeputies: 3 },
  TEAM: { name: 'Nhóm', head: 'Trưởng nhóm', deputy: null, maxDeputies: 0 },
};

export interface UnitLike {
  id: string;
  parentId: string | null;
  unitType: UnitType;
  name?: string;
}

/** Trả câu lỗi nếu `child` (loại `childType`) không được đặt dưới cha loại `parentType`, ngược lại null. */
export function parentRuleError(childType: UnitType, parentType: UnitType | null): string | null {
  const allowed = ALLOWED_PARENT[childType];
  if (parentType === null) {
    return childType === 'COMPANY' ? null : `${UNIT_LABEL[childType].name} phải có đơn vị cha`;
  }
  if (allowed.includes(parentType)) return null;
  if (childType === 'COMPANY') return 'Công ty là gốc của cây, không có đơn vị cha';
  const names = allowed.map((t) => UNIT_LABEL[t].name).join(' hoặc ');
  return `${UNIT_LABEL[childType].name} chỉ đặt dưới ${names}, không đặt dưới ${UNIT_LABEL[parentType].name}`;
}

/**
 * Kiểm một thay đổi loại hoặc cha của đơn vị `id` trên toàn cây: chính nó với cha mới, và các con trực tiếp với loại mới.
 * Trả câu lỗi đầu tiên hoặc null.
 */
export function checkUnitChange(units: UnitLike[], id: string, next: { unitType: UnitType; parentId: string | null }): string | null {
  const byId = new Map(units.map((u) => [u.id, u]));
  const parent = next.parentId ? byId.get(next.parentId) : undefined;
  const own = parentRuleError(next.unitType, parent ? parent.unitType : null);
  if (own) return own;
  for (const child of units) {
    if (child.parentId !== id) continue;
    const err = parentRuleError(child.unitType, next.unitType);
    if (err) return `Không đổi được loại: đơn vị con "${child.name ?? child.id}" sẽ sai luật (${err})`;
  }
  return null;
}

/** Id của đơn vị và mọi đơn vị con cháu (dùng lọc danh bạ gồm đơn vị con, AC-2.1.5). */
export function descendantIds(units: Pick<UnitLike, 'id' | 'parentId'>[], rootId: string): string[] {
  const children = new Map<string, string[]>();
  for (const u of units) if (u.parentId) children.set(u.parentId, [...(children.get(u.parentId) ?? []), u.id]);
  const out: string[] = [];
  const stack = [rootId];
  while (stack.length) {
    const cur = stack.pop()!;
    if (out.includes(cur)) continue;
    out.push(cur);
    stack.push(...(children.get(cur) ?? []));
  }
  return out;
}
