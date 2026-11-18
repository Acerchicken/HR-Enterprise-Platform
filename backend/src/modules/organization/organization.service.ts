import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TtlCache } from '../../common/ttl-cache';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../identity/roles';
import { Department } from './department.entity';
import { CreateDepartmentDto, DepartmentDetail, DepartmentNode, UnitHead, UpdateDepartmentDto } from './organization.dto';
import { Position } from './position.entity';
import { checkUnitChange, descendantIds, parentRuleError, UnitType } from './unit-rules';

const TEN_MINUTES = 10 * 60 * 1000;

@Injectable()
export class OrganizationService {
  private readonly deptCache = new TtlCache<Department[]>(TEN_MINUTES);
  private readonly posCache = new TtlCache<Position[]>(TEN_MINUTES);

  constructor(
    @InjectRepository(Department) private readonly departments: Repository<Department>,
    @InjectRepository(Position) private readonly positions: Repository<Position>,
    private readonly audit: AuditService,
  ) {}

  listDepartments(): Promise<Department[]> {
    return this.deptCache.getOrLoad('all', () => this.departments.find({ order: { code: 'ASC' } }));
  }

  listPositions(): Promise<Position[]> {
    return this.posCache.getOrLoad('all', () => this.positions.find({ order: { level: 'DESC', title: 'ASC' } }));
  }

  /** Đơn vị đang hoạt động (FR-2.10): cây, danh sách chọn chỉ dùng tập này. */
  async activeDepartments(): Promise<Department[]> {
    return (await this.listDepartments()).filter((d) => d.status === 'ACTIVE');
  }

  async getDepartment(id: string): Promise<Department> {
    const dept = (await this.listDepartments()).find((d) => d.id === id);
    if (!dept) throw new NotFoundException('Không tìm thấy phòng ban');
    return dept;
  }

  /** Cây tổ chức (AC-2.2.1, AC-2.2.3): một gốc là Công ty; mỗi nút có loại, trưởng, số người; chỉ đơn vị đang hoạt động. */
  async tree(): Promise<DepartmentNode[]> {
    const depts = await this.activeDepartments();
    const [heads, counts] = await Promise.all([this.headsOf(depts), this.memberCounts()]);
    return buildTree(depts, heads, counts);
  }

  /** Chi tiết đơn vị kèm đường dẫn từ gốc (AC-2.9.4, thẻ sơ đồ tổ chức ở hồ sơ UC1). */
  async detail(id: string): Promise<DepartmentDetail> {
    const all = await this.listDepartments();
    const dept = all.find((d) => d.id === id);
    if (!dept) throw new NotFoundException('Không tìm thấy phòng ban');
    const byId = new Map(all.map((d) => [d.id, d]));
    const path: DepartmentDetail['path'] = [];
    for (let d: Department | undefined = dept; d && !path.some((p) => p.id === d!.id); d = d.parentId ? byId.get(d.parentId) : undefined) {
      path.unshift({ id: d.id, name: d.name, unitType: d.unitType, headEmployeeId: d.headEmployeeId });
    }
    const [heads, counts] = await Promise.all([this.headsOf([dept]), this.memberCounts()]);
    const { children: _c, ...node } = toNode(dept, heads, counts);
    return { ...node, status: dept.status, path };
  }

  /** Đơn vị và mọi đơn vị con cháu (AC-2.1.5). */
  async descendantIds(departmentId: string): Promise<string[]> {
    return descendantIds(await this.listDepartments(), departmentId);
  }

  /** Dùng cho module Employee: tra tên phòng ban/chức danh mà không JOIN chéo schema. */
  /** Phòng ban và mọi phòng ban cha của nó (tài liệu cấp cho phòng cha thì phòng con cũng xem được, DR-02). */
  async ancestorIds(departmentId: string): Promise<string[]> {
    const byId = new Map((await this.listDepartments()).map((d) => [d.id, d]));
    const out: string[] = [];
    for (let d = byId.get(departmentId); d && !out.includes(d.id); d = d.parentId ? byId.get(d.parentId) : undefined) out.push(d.id);
    return out;
  }

  async lookups() {
    const [depts, positions] = await Promise.all([this.listDepartments(), this.listPositions()]);
    return {
      department: new Map(depts.map((d) => [d.id, d])),
      position: new Map(positions.map((p) => [p.id, p])),
    };
  }

  async create(dto: CreateDepartmentDto, actor: AuthUser): Promise<Department> {
    const all = await this.listDepartments();
    let parentType: UnitType | null = null;
    if (dto.parentId) {
      const parent = all.find((d) => d.id === dto.parentId);
      if (!parent) throw new NotFoundException('Không tìm thấy phòng ban');
      if (parent.status !== 'ACTIVE') throw new BadRequestException('Đơn vị cha đã ngừng hoạt động');
      parentType = parent.unitType;
    } else if (all.length > 0) {
      // AC-2.4.6: cây chỉ có một gốc (Công ty). Gốc chỉ được tạo khi cây còn rỗng.
      throw new BadRequestException('Đơn vị mới phải có đơn vị cha (cây tổ chức chỉ có một gốc là Công ty)');
    }
    // AC-2.4.8: luật loại cha, loại con (ADR-14).
    const ruleError = parentRuleError(dto.unitType, parentType);
    if (ruleError) throw new BadRequestException(ruleError);
    if (dto.headEmployeeId) await this.assertActiveEmployee(dto.headEmployeeId);
    const saved = await this.departments.manager.transaction(async (m) => {
      const dept = await m.getRepository(Department).save(
        m.getRepository(Department).create({
          ...dto,
          parentId: dto.parentId ?? null,
          headEmployeeId: dto.headEmployeeId ?? null,
          status: 'ACTIVE',
        }),
      );
      await this.audit.record(
        { actorId: actor.employeeId, action: 'CREATE', entityType: 'department', entityId: dept.id, changedFields: { ...dto } },
        m,
      );
      return dept;
    });
    this.deptCache.clear();
    return saved;
  }

  async update(id: string, dto: UpdateDepartmentDto, actor: AuthUser): Promise<Department> {
    const dept = await this.getDepartment(id);
    if (dto.parentId === null && dept.parentId !== null) {
      throw new BadRequestException('Không thể bỏ phòng ban cha (cây tổ chức chỉ có một gốc)');
    }
    if (dto.headEmployeeId) await this.assertActiveEmployee(dto.headEmployeeId);
    if (dto.parentId !== undefined && dto.parentId !== null) {
      const parent = await this.getDepartment(dto.parentId);
      if (parent.status !== 'ACTIVE') throw new BadRequestException('Đơn vị cha đã ngừng hoạt động');
      if (createsCycle(await this.listDepartments(), id, dto.parentId)) {
        throw new BadRequestException('Không thể đặt phòng ban cha là chính nó hoặc phòng ban con của nó');
      }
    }
    // AC-2.4.8: đổi loại hoặc cha phải giữ đúng luật cho chính đơn vị và các đơn vị con.
    if ((dto.unitType && dto.unitType !== dept.unitType) || (dto.parentId !== undefined && dto.parentId !== dept.parentId)) {
      const err = checkUnitChange(await this.listDepartments(), id, {
        unitType: dto.unitType ?? dept.unitType,
        parentId: dto.parentId !== undefined ? dto.parentId : dept.parentId,
      });
      if (err) throw new BadRequestException(err);
    }
    const changes: Partial<Department> = {};
    for (const key of ['name', 'office', 'unitType', 'parentId', 'headEmployeeId'] as const) {
      if (dto[key] !== undefined && dto[key] !== dept[key]) (changes as any)[key] = dto[key];
    }
    if (Object.keys(changes).length === 0) return dept;

    await this.departments.manager.transaction(async (m) => {
      await m.getRepository(Department).update(id, changes);
      await this.audit.record(
        { actorId: actor.employeeId, action: 'UPDATE', entityType: 'department', entityId: id, changedFields: changes },
        m,
      );
    });
    this.deptCache.clear();
    return this.getDepartment(id);
  }

  /** Tên trưởng đơn vị. Đọc thẳng bảng nhân viên (chỉ đọc) để tránh phụ thuộc vòng với module Employee. */
  private async headsOf(depts: Department[]): Promise<Map<string, UnitHead>> {
    const ids = [...new Set(depts.map((d) => d.headEmployeeId).filter((x): x is string => !!x))];
    if (!ids.length) return new Map();
    const rows: { id: string; full_name: string }[] = await this.departments.manager.query(
      `SELECT id, full_name FROM employee.employee WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    return new Map(rows.map((r) => [r.id, { id: r.id, fullName: r.full_name }]));
  }

  private async memberCounts(): Promise<Map<string, number>> {
    const rows: { department_id: string; n: string }[] = await this.departments.manager.query(
      `SELECT department_id, count(*) AS n FROM employee.employee WHERE status <> 'TERMINATED' GROUP BY department_id`,
    );
    return new Map(rows.map((r) => [r.department_id, Number(r.n)]));
  }

  /** AC-2.4.7: trưởng đơn vị phải là nhân viên đang làm việc. Đọc thẳng bảng nhân viên để tránh phụ thuộc vòng với module Employee. */
  private async assertActiveEmployee(employeeId: string) {
    const rows: { status: string }[] = await this.departments.manager.query(
      `SELECT status FROM employee.employee WHERE id = $1`,
      [employeeId],
    );
    if (!rows.length || rows[0]!.status === 'TERMINATED') {
      throw new BadRequestException('Trưởng đơn vị phải là nhân viên đang làm việc');
    }
  }
}

function toNode(d: Department, heads: Map<string, UnitHead>, counts: Map<string, number>): DepartmentNode {
  return {
    id: d.id,
    code: d.code,
    name: d.name,
    office: d.office,
    unitType: d.unitType,
    parentId: d.parentId,
    headEmployeeId: d.headEmployeeId,
    head: d.headEmployeeId ? heads.get(d.headEmployeeId) ?? null : null,
    memberCount: counts.get(d.id) ?? 0,
    children: [],
  };
}

const TYPE_ORDER: Record<UnitType, number> = { COMPANY: 0, CENTER: 1, DEPARTMENT: 2, TEAM: 3 };

export function buildTree(
  depts: Department[],
  heads: Map<string, UnitHead> = new Map(),
  counts: Map<string, number> = new Map(),
): DepartmentNode[] {
  const nodes = new Map<string, DepartmentNode>();
  for (const d of depts) nodes.set(d.id, toNode(d, heads, counts));
  const roots: DepartmentNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  // Trung tâm trước phòng đứng riêng; cùng loại thì theo tên.
  const sort = (list: DepartmentNode[]) => {
    list.sort((a, b) => TYPE_ORDER[a.unitType] - TYPE_ORDER[b.unitType] || a.name.localeCompare(b.name, 'vi'));
    list.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

/** true nếu gán `newParentId` làm cha của `id` sẽ tạo vòng lặp trong cây. */
export function createsCycle(depts: Pick<Department, 'id' | 'parentId'>[], id: string, newParentId: string): boolean {
  const parentOf = new Map(depts.map((d) => [d.id, d.parentId]));
  let cursor: string | null | undefined = newParentId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === id) return true;
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    cursor = parentOf.get(cursor);
  }
  return false;
}
