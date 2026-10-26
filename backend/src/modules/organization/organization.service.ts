import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TtlCache } from '../../common/ttl-cache';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../identity/roles';
import { Department } from './department.entity';
import { CreateDepartmentDto, DepartmentNode, UpdateDepartmentDto } from './organization.dto';
import { Position } from './position.entity';

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

  async getDepartment(id: string): Promise<Department> {
    const dept = (await this.listDepartments()).find((d) => d.id === id);
    if (!dept) throw new NotFoundException('Không tìm thấy phòng ban');
    return dept;
  }

  /** Cây tổ chức: các phòng ban gốc (parentId = null) và phòng ban con lồng bên trong. */
  async tree(): Promise<DepartmentNode[]> {
    return buildTree(await this.listDepartments());
  }

  /** Dùng cho module Employee: tra tên phòng ban/chức danh mà không JOIN chéo schema. */
  async lookups() {
    const [depts, positions] = await Promise.all([this.listDepartments(), this.listPositions()]);
    return {
      department: new Map(depts.map((d) => [d.id, d])),
      position: new Map(positions.map((p) => [p.id, p])),
    };
  }

  async create(dto: CreateDepartmentDto, actor: AuthUser): Promise<Department> {
    if (dto.parentId) await this.getDepartment(dto.parentId);
    const saved = await this.departments.manager.transaction(async (m) => {
      const dept = await m.getRepository(Department).save(
        m.getRepository(Department).create({ ...dto, parentId: dto.parentId ?? null, headEmployeeId: dto.headEmployeeId ?? null }),
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
    if (dto.parentId !== undefined && dto.parentId !== null) {
      await this.getDepartment(dto.parentId);
      if (createsCycle(await this.listDepartments(), id, dto.parentId)) {
        throw new BadRequestException('Không thể đặt phòng ban cha là chính nó hoặc phòng ban con của nó');
      }
    }
    const changes: Partial<Department> = {};
    for (const key of ['name', 'office', 'parentId', 'headEmployeeId'] as const) {
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
}

export function buildTree(depts: Department[]): DepartmentNode[] {
  const nodes = new Map<string, DepartmentNode>();
  for (const d of depts) {
    nodes.set(d.id, {
      id: d.id,
      code: d.code,
      name: d.name,
      office: d.office,
      parentId: d.parentId,
      headEmployeeId: d.headEmployeeId,
      children: [],
    });
  }
  const roots: DepartmentNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
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
