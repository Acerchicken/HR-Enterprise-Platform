import { buildTree, createsCycle } from './organization.service';
import { Department } from './department.entity';
import { checkUnitChange, descendantIds, parentRuleError, UnitType } from './unit-rules';

const dept = (id: string, parentId: string | null, unitType: UnitType = parentId ? 'DEPARTMENT' : 'COMPANY') =>
  ({ id, code: id.toUpperCase(), name: id, office: 'HN', parentId, unitType, status: 'ACTIVE', headEmployeeId: null }) as Department;

describe('organization tree', () => {
  const depts = [dept('root', null), dept('eng', 'root', 'CENTER'), dept('plt', 'eng'), dept('hr', 'root')];

  it('dựng cây từ danh sách phẳng', () => {
    const tree = buildTree(depts);
    expect(tree).toHaveLength(1);
    expect(tree[0].children.map((c) => c.id).sort()).toEqual(['eng', 'hr']);
    expect(tree[0].children.find((c) => c.id === 'eng')!.children[0].id).toBe('plt');
  });

  it('phát hiện vòng lặp khi đổi phòng ban cha', () => {
    expect(createsCycle(depts, 'eng', 'plt')).toBe(true); // con thành cha
    expect(createsCycle(depts, 'eng', 'eng')).toBe(true); // chính nó
    expect(createsCycle(depts, 'plt', 'hr')).toBe(false);
  });
});

describe('luật loại đơn vị (ADR-14, AC-2.4.8)', () => {
  it('chấp nhận cặp cha con hợp lệ', () => {
    expect(parentRuleError('COMPANY', null)).toBeNull();
    expect(parentRuleError('CENTER', 'COMPANY')).toBeNull();
    expect(parentRuleError('DEPARTMENT', 'COMPANY')).toBeNull();
    expect(parentRuleError('DEPARTMENT', 'CENTER')).toBeNull();
    expect(parentRuleError('TEAM', 'DEPARTMENT')).toBeNull();
  });

  it('từ chối cặp cha con sai luật', () => {
    expect(parentRuleError('TEAM', 'CENTER')).toMatch('Nhóm chỉ đặt dưới Phòng');
    expect(parentRuleError('CENTER', 'CENTER')).toMatch('Trung tâm chỉ đặt dưới Công ty');
    expect(parentRuleError('DEPARTMENT', 'TEAM')).not.toBeNull();
    expect(parentRuleError('COMPANY', 'COMPANY')).toMatch('gốc');
    expect(parentRuleError('DEPARTMENT', null)).toMatch('phải có đơn vị cha');
  });

  const units = [
    dept('hq', null),
    dept('eng', 'hq', 'CENTER'),
    dept('web', 'eng', 'DEPARTMENT'),
    dept('be', 'web', 'TEAM'),
    dept('leg', 'hq', 'DEPARTMENT'),
  ];

  it('đổi loại bị chặn khi đơn vị con sẽ sai luật', () => {
    // eng có phòng con; đổi eng thành phòng thì phòng web nằm dưới phòng.
    expect(checkUnitChange(units, 'eng', { unitType: 'DEPARTMENT', parentId: 'hq' })).toMatch('đơn vị con "web"');
    // đổi web thành nhóm: chính nó sai luật (nhóm dưới trung tâm).
    expect(checkUnitChange(units, 'web', { unitType: 'TEAM', parentId: 'eng' })).toMatch('Nhóm chỉ đặt dưới Phòng');
  });

  it('đổi cha hợp lệ thì cho qua', () => {
    expect(checkUnitChange(units, 'leg', { unitType: 'DEPARTMENT', parentId: 'eng' })).toBeNull();
    expect(checkUnitChange(units, 'be', { unitType: 'TEAM', parentId: 'leg' })).toBeNull();
    expect(checkUnitChange(units, 'be', { unitType: 'TEAM', parentId: 'eng' })).not.toBeNull();
  });

  it('lấy đơn vị và mọi đơn vị con cháu (AC-2.1.5)', () => {
    expect(descendantIds(units, 'eng').sort()).toEqual(['be', 'eng', 'web']);
    expect(descendantIds(units, 'leg')).toEqual(['leg']);
  });

  it('cây xếp trung tâm trước phòng đứng riêng', () => {
    const tree = buildTree([dept('hq', null), dept('a-leg', 'hq', 'DEPARTMENT'), dept('z-eng', 'hq', 'CENTER')]);
    expect(tree[0].children.map((c) => c.id)).toEqual(['z-eng', 'a-leg']);
  });
});
