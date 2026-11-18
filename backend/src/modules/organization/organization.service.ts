import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { TtlCache } from '../../common/ttl-cache';
import { AuditService } from '../audit/audit.service';
import { AuthUser, hasRole } from '../identity/roles';
import { DepartmentDeputy } from './department-deputy.entity';
import { Department } from './department.entity';
import {
  CreateDepartmentDto,
  CreatePositionDto,
  DepartmentDetail,
  DepartmentNode,
  PositionView,
  UnitDeputy,
  UnitHead,
  UpdateDepartmentDto,
  UpdatePositionDto,
} from './organization.dto';
import { Position } from './position.entity';
import { checkUnitChange, descendantIds, parentRuleError, UNIT_LABEL, UnitType } from './unit-rules';

const TEN_MINUTES = 10 * 60 * 1000;

@Injectable()
export class OrganizationService {
  private readonly deptCache = new TtlCache<Department[]>(TEN_MINUTES);
  private readonly posCache = new TtlCache<Position[]>(TEN_MINUTES);

  constructor(
    @InjectRepository(Department) private readonly departments: Repository<Department>,
    @InjectRepository(Position) private readonly positions: Repository<Position>,
    @InjectRepository(DepartmentDeputy) private readonly deputies: Repository<DepartmentDeputy>,
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
  async detail(id: string, viewer: AuthUser): Promise<DepartmentDetail> {
    const all = await this.listDepartments();
    const dept = all.find((d) => d.id === id);
    // E5: đơn vị ngừng hoạt động chỉ HR, ADMIN thấy.
    if (!dept || (dept.status !== 'ACTIVE' && !hasRole(viewer, 'HR', 'ADMIN'))) throw new NotFoundException('Không tìm thấy phòng ban');
    const byId = new Map(all.map((d) => [d.id, d]));
    const path: DepartmentDetail['path'] = [];
    for (let d: Department | undefined = dept; d && !path.some((p) => p.id === d!.id); d = d.parentId ? byId.get(d.parentId) : undefined) {
      path.unshift({ id: d.id, name: d.name, unitType: d.unitType, headEmployeeId: d.headEmployeeId });
    }
    const [heads, counts, deputies] = await Promise.all([this.headsOf([dept]), this.memberCounts(), this.deputiesOf(id)]);
    const { children: _c, ...node } = toNode(dept, heads, counts);
    return { ...node, status: dept.status, headActing: dept.headActing, deputies, path };
  }

  /** Danh sách phẳng: HR, ADMIN thấy cả đơn vị ngừng hoạt động (để kích hoạt lại); người khác chỉ đơn vị đang hoạt động. */
  async listFor(viewer: AuthUser): Promise<Department[]> {
    return hasRole(viewer, 'HR', 'ADMIN') ? this.listDepartments() : this.activeDepartments();
  }

  private async deputiesOf(departmentId: string): Promise<UnitDeputy[]> {
    const rows: { id: string; full_name: string; position_id: string }[] = await this.departments.manager.query(
      `SELECT e.id, e.full_name, e.position_id FROM org.department_deputy d
       JOIN employee.employee e ON e.id = d.employee_id WHERE d.department_id = $1 ORDER BY d.created_at, e.full_name`,
      [departmentId],
    );
    const positions = new Map((await this.listPositions()).map((p) => [p.id, p.title]));
    return rows.map((r) => ({ id: r.id, fullName: r.full_name, positionTitle: positions.get(r.position_id) ?? null }));
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
    if (all.some((d) => d.code === dto.code)) throw new ConflictException('Mã đơn vị đã tồn tại');
    // AC-2.9.1: đơn vị mới chưa có người, nên trưởng, phó lấy từ đơn vị cha trở lên (kiêm nhiệm).
    const deputies = [...new Set(dto.deputyEmployeeIds ?? [])];
    await this.assertRoleHolders(dto.parentId ? this.chain(all, dto.parentId) : [], dto.unitType, dto.headEmployeeId ?? null, deputies, [
      ...(dto.headEmployeeId ? [dto.headEmployeeId] : []),
      ...deputies,
    ]);
    const saved = await this.departments.manager.transaction(async (m) => {
      const { deputyEmployeeIds: _d, ...fields } = dto;
      const dept = await m.getRepository(Department).save(
        m.getRepository(Department).create({
          ...fields,
          parentId: dto.parentId ?? null,
          headEmployeeId: dto.headEmployeeId ?? null,
          headActing: !!dto.headEmployeeId && !!dto.headActing,
          status: 'ACTIVE',
        }),
      );
      if (deputies.length) {
        await m.getRepository(DepartmentDeputy).insert(
          deputies.map((employeeId) => ({ departmentId: dept.id, employeeId, createdBy: actor.employeeId })),
        );
      }
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
    const all = await this.listDepartments();
    const dept = all.find((d) => d.id === id);
    if (!dept) throw new NotFoundException('Không tìm thấy phòng ban');
    const reactivating = dto.status === 'ACTIVE' && dept.status === 'INACTIVE';
    const deactivating = dto.status === 'INACTIVE' && dept.status === 'ACTIVE';
    if (dept.status === 'INACTIVE' && !reactivating) throw new BadRequestException('Đơn vị đã ngừng hoạt động; hãy kích hoạt lại trước khi sửa');
    if (dto.parentId === null && dept.parentId !== null) {
      throw new BadRequestException('Không thể bỏ phòng ban cha (cây tổ chức chỉ có một gốc)');
    }
    if (dto.parentId !== undefined && dto.parentId !== null) {
      const parent = all.find((d) => d.id === dto.parentId);
      if (!parent) throw new NotFoundException('Không tìm thấy phòng ban');
      if (parent.status !== 'ACTIVE') throw new BadRequestException('Đơn vị cha đã ngừng hoạt động');
      if (createsCycle(all, id, dto.parentId)) {
        throw new BadRequestException('Không thể đặt phòng ban cha là chính nó hoặc phòng ban con của nó');
      }
    }
    if (reactivating && dept.parentId && all.find((d) => d.id === dept.parentId)?.status !== 'ACTIVE') {
      throw new BadRequestException('Đơn vị cha đã ngừng hoạt động; hãy kích hoạt đơn vị cha trước');
    }
    // AC-2.4.8: đổi loại hoặc cha phải giữ đúng luật cho chính đơn vị và các đơn vị con.
    const nextType = dto.unitType ?? dept.unitType;
    const nextParent = dto.parentId !== undefined ? dto.parentId : dept.parentId;
    if (nextType !== dept.unitType || nextParent !== dept.parentId) {
      const err = checkUnitChange(all, id, { unitType: nextType, parentId: nextParent });
      if (err) throw new BadRequestException(err);
    }

    // FR-2.10, AC-2.10.1: chỉ ngừng hoạt động đơn vị đã trống; trưởng, phó kiêm nhiệm từ đơn vị cha không tính là người của đơn vị.
    if (deactivating) {
      if (dept.unitType === 'COMPANY') throw new BadRequestException('Không thể ngừng hoạt động Công ty');
      const [{ n }] = await this.departments.manager.query(
        `SELECT count(*)::int AS n FROM employee.employee WHERE department_id = $1 AND status <> 'TERMINATED'`,
        [id],
      );
      const activeChildren = all.filter((d) => d.parentId === id && d.status === 'ACTIVE').length;
      if (n > 0 || activeChildren > 0) {
        const parts = [n > 0 ? `${n} nhân viên đang làm việc` : '', activeChildren > 0 ? `${activeChildren} đơn vị con đang hoạt động` : '']
          .filter(Boolean)
          .join(' và ');
        throw new ConflictException({
          message: `Đơn vị còn ${parts}. Hãy điều chuyển người, ngừng hoạt động đơn vị con trước`,
          details: { members: n, activeChildren, scheduledTransfers: 0 },
        });
      }
    }

    // Trưởng, phó (FR-2.9). Chỉ kiểm người mới được gán; đơn vị ngừng hoạt động thì gỡ hết.
    const currentDeputies = await this.deputyIds(id);
    const nextHead = deactivating ? null : dto.headEmployeeId !== undefined ? dto.headEmployeeId : dept.headEmployeeId;
    const nextDeputies = deactivating ? [] : dto.deputyEmployeeIds ? [...new Set(dto.deputyEmployeeIds)] : currentDeputies;
    const newcomers = [
      ...(nextHead && nextHead !== dept.headEmployeeId ? [nextHead] : []),
      ...nextDeputies.filter((d) => !currentDeputies.includes(d)),
    ];
    const rolesChanged = nextHead !== dept.headEmployeeId || !sameSet(nextDeputies, currentDeputies);
    if (!deactivating && (rolesChanged || nextType !== dept.unitType)) {
      await this.assertRoleHolders(this.chain(all, id, nextParent), nextType, nextHead, nextDeputies, newcomers);
    }

    const changes: Partial<Department> = {};
    for (const key of ['name', 'office', 'unitType', 'parentId', 'status'] as const) {
      if (dto[key] !== undefined && dto[key] !== dept[key]) (changes as any)[key] = dto[key];
    }
    if (nextHead !== dept.headEmployeeId) changes.headEmployeeId = nextHead;
    const nextActing = nextHead ? (dto.headActing ?? (nextHead === dept.headEmployeeId ? dept.headActing : false)) : false;
    if (nextActing !== dept.headActing) changes.headActing = nextActing;
    const added = nextDeputies.filter((d) => !currentDeputies.includes(d));
    const removed = currentDeputies.filter((d) => !nextDeputies.includes(d));
    if (Object.keys(changes).length === 0 && !added.length && !removed.length) return dept;

    await this.departments.manager.transaction(async (m) => {
      if (Object.keys(changes).length) await m.getRepository(Department).update(id, changes);
      if (removed.length) await m.getRepository(DepartmentDeputy).delete({ departmentId: id, employeeId: In(removed) });
      if (added.length) {
        await m
          .getRepository(DepartmentDeputy)
          .insert(added.map((employeeId) => ({ departmentId: id, employeeId, createdBy: actor.employeeId })));
      }
      // AC-2.9.5: đổi trưởng, phó có audit; không tự đổi quản lý trực tiếp của ai.
      const changedFields: Record<string, unknown> = { ...changes };
      if (added.length || removed.length) changedFields.deputies = { added, removed };
      await this.audit.record({ actorId: actor.employeeId, action: 'UPDATE', entityType: 'department', entityId: id, changedFields }, m);
    });
    this.deptCache.clear();
    return this.getDepartment(id);
  }

  /**
   * AC-2.9.8 (UC1 AC-1.7.3): người nghỉ việc được gỡ khỏi mọi vai trò trưởng, phó trong cùng giao dịch, có audit.
   * Trả các vai trò đã gỡ. Không chặn việc nghỉ việc.
   */
  async removeRolesOf(employeeId: string, actor: AuthUser, m: EntityManager): Promise<{ departmentId: string; role: 'HEAD' | 'DEPUTY' }[]> {
    const heads: { id: string }[] = await m.query(`SELECT id FROM org.department WHERE head_employee_id = $1`, [employeeId]);
    const deputies: { department_id: string }[] = await m.query(
      `SELECT department_id FROM org.department_deputy WHERE employee_id = $1`,
      [employeeId],
    );
    const removed = [
      ...heads.map((h) => ({ departmentId: h.id, role: 'HEAD' as const })),
      ...deputies.map((d) => ({ departmentId: d.department_id, role: 'DEPUTY' as const })),
    ];
    if (!removed.length) return removed;
    await m.query(`UPDATE org.department SET head_employee_id = NULL, head_acting = false WHERE head_employee_id = $1`, [employeeId]);
    await m.query(`DELETE FROM org.department_deputy WHERE employee_id = $1`, [employeeId]);
    for (const r of removed) {
      const changedFields =
        r.role === 'HEAD'
          ? { headEmployeeId: null, reason: 'EMPLOYEE_TERMINATED' }
          : { deputies: { added: [], removed: [employeeId] }, reason: 'EMPLOYEE_TERMINATED' };
      await this.audit.record({ actorId: actor.employeeId, action: 'UPDATE', entityType: 'department', entityId: r.departmentId, changedFields }, m);
    }
    this.deptCache.clear();
    return removed;
  }

  /** Các đơn vị người này đang làm trưởng, phó (hộp xác nhận nghỉ việc, AC-2.9.8). */
  async rolesOf(employeeId: string): Promise<{ departmentId: string; name: string; role: 'HEAD' | 'DEPUTY' }[]> {
    const all = await this.listDepartments();
    const deputyOf: { department_id: string }[] = await this.departments.manager.query(
      `SELECT department_id FROM org.department_deputy WHERE employee_id = $1`,
      [employeeId],
    );
    return [
      ...all.filter((d) => d.headEmployeeId === employeeId).map((d) => ({ departmentId: d.id, name: d.name, role: 'HEAD' as const })),
      ...deputyOf.map((r) => ({ departmentId: r.department_id, name: all.find((d) => d.id === r.department_id)?.name ?? '', role: 'DEPUTY' as const })),
    ];
  }

  // ---------- Chức danh (FR-2.6) ----------

  async positionViews(activeOnly = false): Promise<PositionView[]> {
    const [list, rows] = await Promise.all([
      this.listPositions(),
      this.positions.manager.query(
        `SELECT position_id, count(*)::int AS n FROM employee.employee WHERE status <> 'TERMINATED' GROUP BY position_id`,
      ) as Promise<{ position_id: string; n: number }[]>,
    ]);
    const holders = new Map(rows.map((r) => [r.position_id, r.n]));
    return list
      .filter((p) => !activeOnly || p.active)
      .map((p) => ({ id: p.id, code: p.code, title: p.title, level: p.level, active: p.active, system: p.isSystem, holderCount: holders.get(p.id) ?? 0 }));
  }

  async createPosition(dto: CreatePositionDto, actor: AuthUser): Promise<Position> {
    if ((await this.listPositions()).some((p) => p.code === dto.code)) throw new ConflictException('Mã chức danh đã tồn tại');
    const saved = await this.positions.manager.transaction(async (m) => {
      const p = await m.getRepository(Position).save(m.getRepository(Position).create({ ...dto, active: true, isSystem: false }));
      await this.audit.record({ actorId: actor.employeeId, action: 'CREATE', entityType: 'position', entityId: p.id, changedFields: { ...dto } }, m);
      return p;
    });
    this.posCache.clear();
    return saved;
  }

  async updatePosition(id: string, dto: UpdatePositionDto, actor: AuthUser): Promise<Position> {
    const pos = (await this.listPositions()).find((p) => p.id === id);
    if (!pos) throw new NotFoundException('Không tìm thấy chức danh');
    // AC-2.6.3: chức danh hệ thống chỉ đổi được tên hiển thị.
    if (pos.isSystem && ((dto.level !== undefined && dto.level !== pos.level) || dto.active === false)) {
      throw new BadRequestException(`"${pos.title}" là chức danh hệ thống: chỉ đổi được tên, không đổi cấp bậc hay ngừng dùng`);
    }
    const changes: Partial<Position> = {};
    for (const key of ['title', 'level', 'active'] as const) {
      if (dto[key] !== undefined && dto[key] !== pos[key]) (changes as any)[key] = dto[key];
    }
    if (!Object.keys(changes).length) return pos;
    await this.positions.manager.transaction(async (m) => {
      await m.getRepository(Position).update(id, changes);
      await this.audit.record({ actorId: actor.employeeId, action: 'UPDATE', entityType: 'position', entityId: id, changedFields: changes }, m);
    });
    this.posCache.clear();
    return { ...pos, ...changes };
  }

  // ---------- Hỗ trợ ----------

  /** Id của đơn vị `id` (hoặc đơn vị sẽ có cha `parentOverride`) và mọi đơn vị cha của nó. */
  private chain(all: Department[], id: string, parentOverride?: string | null): string[] {
    const byId = new Map(all.map((d) => [d.id, d]));
    const out = [id];
    let cursor = parentOverride !== undefined ? parentOverride : byId.get(id)?.parentId ?? null;
    while (cursor && !out.includes(cursor)) {
      out.push(cursor);
      cursor = byId.get(cursor)?.parentId ?? null;
    }
    return out;
  }

  private async deputyIds(departmentId: string): Promise<string[]> {
    const rows = await this.deputies.find({ where: { departmentId }, order: { createdAt: 'ASC' } });
    return rows.map((r) => r.employeeId);
  }

  /**
   * AC-2.4.7, AC-2.9.1 (E8): trưởng, phó là nhân viên đang làm việc thuộc đơn vị hoặc một đơn vị cha (`allowedUnits`);
   * phó không trùng trưởng, không quá số tối đa theo loại. Chỉ kiểm tư cách của `newcomers` (người mới được gán).
   */
  private async assertRoleHolders(allowedUnits: string[], unitType: UnitType, head: string | null, deputies: string[], newcomers: string[]) {
    const max = UNIT_LABEL[unitType].maxDeputies;
    if (deputies.length > max) {
      throw new BadRequestException(
        max === 0 ? `${UNIT_LABEL[unitType].name} không có phó` : `${UNIT_LABEL[unitType].name} có tối đa ${max} ${UNIT_LABEL[unitType].deputy}`,
      );
    }
    if (head && deputies.includes(head)) throw new BadRequestException('Một người không vừa là trưởng vừa là phó của cùng đơn vị');
    const ids = [...new Set(newcomers)];
    if (!ids.length) return;
    const rows: { id: string; full_name: string; status: string; department_id: string }[] = await this.departments.manager.query(
      `SELECT id, full_name, status, department_id FROM employee.employee WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    for (const id of ids) {
      const e = rows.find((r) => r.id === id);
      const role = id === head ? 'Trưởng đơn vị' : 'Phó đơn vị';
      if (!e || e.status === 'TERMINATED') throw new BadRequestException(`${role} phải là nhân viên đang làm việc`);
      if (!allowedUnits.includes(e.department_id)) {
        throw new BadRequestException(`${role} phải thuộc chính đơn vị hoặc một đơn vị cha của nó (${e.full_name} ở nhánh khác)`);
      }
    }
  }

  /** Tên trưởng đơn vị. Đọc thẳng bảng nhân viên (chỉ đọc) để tránh phụ thuộc vòng với module Employee. */
  private async headsOf(depts: Department[]): Promise<Map<string, { id: string; fullName: string }>> {
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
}

type HeadName = Omit<UnitHead, 'acting'>;

function toNode(d: Department, heads: Map<string, HeadName>, counts: Map<string, number>): DepartmentNode {
  const head = d.headEmployeeId ? heads.get(d.headEmployeeId) : undefined;
  return {
    id: d.id,
    code: d.code,
    name: d.name,
    office: d.office,
    unitType: d.unitType,
    parentId: d.parentId,
    headEmployeeId: d.headEmployeeId,
    head: head ? { ...head, acting: d.headActing } : null,
    memberCount: counts.get(d.id) ?? 0,
    children: [],
  };
}

const TYPE_ORDER: Record<UnitType, number> = { COMPANY: 0, CENTER: 1, DEPARTMENT: 2, TEAM: 3 };

export function buildTree(
  depts: Department[],
  heads: Map<string, HeadName> = new Map(),
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

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}
