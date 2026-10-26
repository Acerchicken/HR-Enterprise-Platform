import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, In, Repository } from 'typeorm';
import { FieldCrypto } from '../../common/field-crypto';
import { Page } from '../../common/pagination';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../identity/roles';
import { OrganizationService } from '../organization/organization.service';
import { forbiddenFields, viewLevel } from './employee-access';
import { EmployeeSensitive } from './employee-sensitive.entity';
import { Employee } from './employee.entity';
import { CreateEmployeeDto, DirectoryEntry, EmployeeProfile, UpdateEmployeeDto } from './employee.dto';

export const FIELD_CRYPTO = Symbol('FIELD_CRYPTO');

export interface RequestMeta {
  ip?: string | null;
  traceId?: string | null;
}

const SENSITIVE_KEYS = ['nationalId', 'bankAccount', 'salary'] as const;

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(Employee) private readonly repo: Repository<Employee>,
    @InjectRepository(EmployeeSensitive) private readonly sensitiveRepo: Repository<EmployeeSensitive>,
    private readonly org: OrganizationService,
    private readonly audit: AuditService,
    @Inject(FIELD_CRYPTO) private readonly crypto: FieldCrypto,
  ) {}

  // ---------- Interface cho module Identity ----------

  findByWorkEmail(email: string) {
    return this.repo.findOneBy({ workEmail: email.toLowerCase() });
  }

  async hasDirectReports(employeeId: string): Promise<boolean> {
    return this.repo.exists({ where: { managerId: employeeId, status: In(['ACTIVE', 'ON_LEAVE']) } });
  }

  // ---------- Danh bạ ----------

  async directory(params: { q?: string; dept?: string; managerId?: string; page: number; size: number }): Promise<Page<DirectoryEntry>> {
    const qb = this.repo
      .createQueryBuilder('e')
      .where("e.status <> 'TERMINATED'")
      .orderBy('e.full_name', 'ASC')
      .addOrderBy('e.id', 'ASC');
    if (params.dept) qb.andWhere('e.department_id = :dept', { dept: params.dept });
    if (params.managerId) qb.andWhere('e.manager_id = :mid', { mid: params.managerId });
    if (params.q) {
      const term = `%${params.q.toLowerCase().replace(/[%_\\]/g, (c) => '\\' + c)}%`;
      qb.andWhere(
        new Brackets((w) =>
          w.where(`lower(e.full_name || ' ' || e.work_email || ' ' || e.employee_code) LIKE :term`, { term }),
        ),
      );
    }
    const [rows, total] = await qb
      .skip((params.page - 1) * params.size)
      .take(params.size)
      .getManyAndCount();
    return { items: await this.toDirectory(rows), page: params.page, size: params.size, total };
  }

  async directReports(id: string): Promise<DirectoryEntry[]> {
    await this.getOrThrow(id);
    const rows = await this.repo.find({
      where: { managerId: id, status: In(['ACTIVE', 'ON_LEAVE']) },
      order: { fullName: 'ASC' },
    });
    return this.toDirectory(rows);
  }

  // ---------- Hồ sơ ----------

  async profile(id: string, actor: AuthUser, includeSensitive: boolean, meta: RequestMeta = {}): Promise<EmployeeProfile> {
    const e = await this.getOrThrow(id);
    const level = viewLevel(actor, e);
    const [entry] = await this.toDirectory([e]);
    const profile: EmployeeProfile = { ...entry, visibility: level };

    if (level !== 'PUBLIC') {
      Object.assign(profile, {
        dateOfBirth: e.dateOfBirth,
        address: e.address,
        hireDate: e.hireDate,
        status: e.status,
        version: e.version,
      });
    }
    if (includeSensitive) {
      if (level !== 'HR') throw new ForbiddenException('Chỉ HR được xem trường nhạy cảm');
      const s = await this.sensitiveRepo.findOneBy({ employeeId: id });
      profile.sensitive = {
        nationalId: this.crypto.decrypt(s?.nationalIdEnc),
        bankAccount: this.crypto.decrypt(s?.bankAccountEnc),
        salary: this.crypto.decrypt(s?.salaryEnc),
      };
      // NFR: 100% lượt đọc trường nhạy cảm phải được audit.
      await this.audit.record({
        actorId: actor.employeeId,
        action: 'VIEW_SENSITIVE',
        entityType: 'employee',
        entityId: id,
        changedFields: { fields: [...SENSITIVE_KEYS] },
        ...meta,
      });
    }
    return profile;
  }

  async update(id: string, dto: UpdateEmployeeDto, actor: AuthUser, meta: RequestMeta = {}): Promise<EmployeeProfile> {
    const denied = forbiddenFields(actor, id, dto);
    if (denied.length) throw new ForbiddenException(`Không được sửa: ${denied.join(', ')}`);

    await this.repo.manager.transaction(async (m) => {
      const repo = m.getRepository(Employee);
      const e = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!e) throw new NotFoundException('Không tìm thấy nhân viên');
      if (dto.version !== undefined && dto.version !== e.version) {
        throw new ConflictException('Hồ sơ đã được người khác cập nhật, hãy tải lại');
      }

      const lookups = await this.org.lookups();
      if (dto.departmentId && !lookups.department.has(dto.departmentId)) throw new BadRequestException('Phòng ban không tồn tại');
      if (dto.positionId && !lookups.position.has(dto.positionId)) throw new BadRequestException('Chức danh không tồn tại');
      if (dto.managerId) await this.assertNoManagerCycle(m, id, dto.managerId);

      const changes: Partial<Employee> = {};
      for (const key of ['phone', 'address', 'fullName', 'dateOfBirth', 'departmentId', 'positionId', 'managerId', 'status'] as const) {
        if (dto[key] !== undefined && dto[key] !== e[key]) (changes as any)[key] = dto[key];
      }
      const sensitiveChanged = SENSITIVE_KEYS.filter((k) => dto[k] !== undefined);

      if (Object.keys(changes).length) {
        await repo.save({ ...e, ...changes });
      }
      if (sensitiveChanged.length) {
        const sRepo = m.getRepository(EmployeeSensitive);
        const current = (await sRepo.findOneBy({ employeeId: id })) ?? sRepo.create({ employeeId: id });
        if (dto.nationalId !== undefined) current.nationalIdEnc = this.crypto.encrypt(dto.nationalId);
        if (dto.bankAccount !== undefined) current.bankAccountEnc = this.crypto.encrypt(dto.bankAccount);
        if (dto.salary !== undefined) current.salaryEnc = this.crypto.encrypt(dto.salary);
        await sRepo.save(current);
      }
      if (Object.keys(changes).length || sensitiveChanged.length) {
        // Giá trị trường nhạy cảm không bao giờ ghi vào log, chỉ ghi tên trường.
        const masked = Object.fromEntries(sensitiveChanged.map((k) => [k, '***']));
        await this.audit.record(
          { actorId: actor.employeeId, action: 'UPDATE', entityType: 'employee', entityId: id, changedFields: { ...changes, ...masked }, ...meta },
          m,
        );
      }
    });
    return this.profile(id, actor, false);
  }

  async create(dto: CreateEmployeeDto, actor: AuthUser, meta: RequestMeta = {}): Promise<EmployeeProfile> {
    const lookups = await this.org.lookups();
    if (!lookups.department.has(dto.departmentId)) throw new BadRequestException('Phòng ban không tồn tại');
    if (!lookups.position.has(dto.positionId)) throw new BadRequestException('Chức danh không tồn tại');
    if (dto.managerId) await this.getOrThrow(dto.managerId);

    const id = await this.repo.manager.transaction(async (m) => {
      const saved = await m.getRepository(Employee).save(
        m.getRepository(Employee).create({ ...dto, workEmail: dto.workEmail.toLowerCase(), managerId: dto.managerId ?? null }),
      );
      await this.audit.record(
        { actorId: actor.employeeId, action: 'CREATE', entityType: 'employee', entityId: saved.id, changedFields: { ...dto }, ...meta },
        m,
      );
      return saved.id;
    });
    return this.profile(id, actor, false);
  }

  // ---------- Nội bộ ----------

  private async getOrThrow(id: string): Promise<Employee> {
    const e = await this.repo.findOneBy({ id });
    if (!e) throw new NotFoundException('Không tìm thấy nhân viên');
    return e;
  }

  /** Mỗi nhân viên có đúng 1 quản lý trực tiếp, và chuỗi quản lý không được tạo vòng. */
  private async assertNoManagerCycle(m: EntityManager, employeeId: string, managerId: string) {
    if (managerId === employeeId) throw new BadRequestException('Nhân viên không thể tự quản lý mình');
    const rows: { id: string }[] = await m.query(
      `WITH RECURSIVE chain AS (
         SELECT id, manager_id, 1 AS depth FROM employee.employee WHERE id = $1
         UNION ALL
         SELECT e.id, e.manager_id, c.depth + 1 FROM employee.employee e
         JOIN chain c ON e.id = c.manager_id WHERE c.depth < 50
       ) SELECT id FROM chain`,
      [managerId],
    );
    if (rows.length === 0) throw new BadRequestException('Quản lý không tồn tại');
    if (rows.some((r) => r.id === employeeId)) {
      throw new BadRequestException('Gán quản lý này sẽ tạo vòng lặp trong sơ đồ tổ chức');
    }
  }

  private async toDirectory(rows: Employee[]): Promise<DirectoryEntry[]> {
    const lookups = await this.org.lookups();
    const managerIds = [...new Set(rows.map((r) => r.managerId).filter((x): x is string => !!x))];
    const managers = managerIds.length
      ? await this.repo.find({ where: { id: In(managerIds) }, select: { id: true, fullName: true } })
      : [];
    const managerName = new Map(managers.map((mgr) => [mgr.id, mgr.fullName]));
    return rows.map((e) => ({
      id: e.id,
      employeeCode: e.employeeCode,
      fullName: e.fullName,
      workEmail: e.workEmail,
      phone: e.phone,
      departmentId: e.departmentId,
      departmentName: lookups.department.get(e.departmentId)?.name ?? null,
      positionTitle: lookups.position.get(e.positionId)?.title ?? null,
      managerId: e.managerId,
      managerName: e.managerId ? (managerName.get(e.managerId) ?? null) : null,
    }));
  }
}
