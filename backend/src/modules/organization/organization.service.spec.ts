import { buildTree, createsCycle } from './organization.service';
import { Department } from './department.entity';

const dept = (id: string, parentId: string | null) =>
  ({ id, code: id.toUpperCase(), name: id, office: 'HN', parentId, headEmployeeId: null }) as Department;

describe('organization tree', () => {
  const depts = [dept('root', null), dept('eng', 'root'), dept('plt', 'eng'), dept('hr', 'root')];

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
