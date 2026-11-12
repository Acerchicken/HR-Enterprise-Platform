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


/** Mã chức danh của Tổng Giám đốc trong danh mục chức danh. */
export const CEO_POSITION = 'CEO';
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

  // ---------- Interface cho module Leave ----------

  /** Quản lý trực tiếp hiện tại của nhân viên (null nếu không có hoặc không tồn tại). */
  /** CEO là người giữ chức danh mã `CEO` (issue #22: người duy nhất không có quản lý trực tiếp). */
  async isCeo(employeeId: string): Promise<boolean> {
    const e = await this.repo.findOne({ where: { id: employeeId }, select: { id: true, positionId: true } });
    if (!e) return false;
    return (await this.org.lookups()).position.get(e.positionId)?.code === CEO_POSITION;
  }

  /** Nhân viên đang giữ chức danh CEO (chưa nghỉ việc); HR duyệt đơn nghỉ của những người này. */
  async ceoIds(): Promise<string[]> {
    const ceo = [...(await this.org.lookups()).position.values()].find((p) => p.code === CEO_POSITION);
    if (!ceo) return [];
    const rows = await this.repo.find({ where: { positionId: ceo.id, status: In(['ACTIVE', 'ON_LEAVE']) }, select: { id: true } });
    return rows.map((r) => r.id);
  }

  /** Phòng ban và trạng thái hiện tại (module tài liệu dùng để tính phạm vi xem, DR-02, DR-06). */
  async placementOf(employeeId: string): Promise<{ departmentId: string; status: string } | null> {
    const e = await this.repo.findOne({ where: { id: employeeId }, select: { id: true, departmentId: true, status: true } });
    return e ? { departmentId: e.departmentId, status: e.status } : null;
  }

  async managerIdOf(employeeId: string): Promise<string | null> {
    const e = await this.repo.findOne({ where: { id: employeeId }, select: { id: true, managerId: true } });
    return e?.managerId ?? null;
  }

  async directReportIds(managerId: string): Promise<string[]> {
    const rows = await this.repo.find({
      where: { managerId, status: In(['ACTIVE', 'ON_LEAVE']) },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /** Email công việc để gửi thông báo (dùng cho worker). */
  async contactOf(employeeId: string): Promise<{ email: string; fullName: string } | null> {
    const e = await this.repo.findOne({ where: { id: employeeId }, select: { id: true, workEmail: true, fullName: true } });
    return e ? { email: e.workEmail, fullName: e.fullName } : null;
  }

  async namesOf(ids: string[]): Promise<Map<string, string>> {
    if (!ids.length) return new Map();
    const rows = await this.repo.find({ where: { id: In([...new Set(ids)]) }, select: { id: true, fullName: true } });
    return new Map(rows.map((r) => [r.id, r.fullName]));
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
      if (dto.positionId !== undefined || dto.managerId !== undefined) {
        await this.assertManagerRule(m, lookups, {
          employeeId: id,
          positionId: dto.positionId ?? e.positionId,
          managerId: dto.managerId !== undefined ? dto.managerId : e.managerId,
        });
      }

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

    const { nationalId, bankAccount, salary, ...plain } = dto;
    const sensitiveGiven = SENSITIVE_KEYS.filter((k) => dto[k] !== undefined);
    const id = await this.repo.manager.transaction(async (m) => {
      await this.assertManagerRule(m, lookups, { positionId: dto.positionId, managerId: dto.managerId ?? null });
      const saved = await m.getRepository(Employee).save(
        m.getRepository(Employee).create({ ...plain, workEmail: dto.workEmail.toLowerCase(), managerId: dto.managerId ?? null }),
      );
      if (sensitiveGiven.length) {
        const sRepo = m.getRepository(EmployeeSensitive);
        await sRepo.save(
          sRepo.create({
            employeeId: saved.id,
            nationalIdEnc: nationalId !== undefined ? this.crypto.encrypt(nationalId) : null,
            bankAccountEnc: bankAccount !== undefined ? this.crypto.encrypt(bankAccount) : null,
            salaryEnc: salary !== undefined ? this.crypto.encrypt(salary) : null,
          }),
        );
      }
      // Giá trị trường nhạy cảm không bao giờ ghi vào log, chỉ ghi tên trường.
      const masked = Object.fromEntries(sensitiveGiven.map((k) => [k, '***']));
      await this.audit.record(
        { actorId: actor.employeeId, action: 'CREATE', entityType: 'employee', entityId: saved.id, changedFields: { ...plain, ...masked }, ...meta },
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

  /**
   * Issue #22 (FR-2.5): chỉ có một CEO và CEO không có quản lý; mọi nhân viên khác phải có đúng một quản lý trực tiếp
   * đang làm việc.
   */
  private async assertManagerRule(
    m: EntityManager,
    lookups: Awaited<ReturnType<OrganizationService['lookups']>>,
    target: { employeeId?: string; positionId: string; managerId: string | null },
  ) {
    const ceoPosition = lookups.position.get(target.positionId)?.code === CEO_POSITION;
    if (ceoPosition) {
      if (target.managerId) throw new BadRequestException('CEO không có quản lý trực tiếp');
      const other: { id: string }[] = await m.query(
        `SELECT id FROM employee.employee WHERE position_id = $1 AND status <> 'TERMINATED' AND id <> $2 LIMIT 1`,
        [target.positionId, target.employeeId ?? '00000000-0000-0000-0000-000000000000'],
      );
      if (other.length) throw new BadRequestException('Đã có một CEO, không thể có CEO thứ hai');
      return;
    }
    if (!target.managerId) throw new BadRequestException('Nhân viên phải có quản lý trực tiếp (chỉ CEO được để trống)');
    const manager = await m.getRepository(Employee).findOne({ where: { id: target.managerId }, select: { id: true, status: true } });
    if (!manager) throw new BadRequestException('Quản lý không tồn tại');
    if (manager.status === 'TERMINATED') throw new BadRequestException('Quản lý trực tiếp đã nghỉ việc');
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
      positionId: e.positionId,
      positionTitle: lookups.position.get(e.positionId)?.title ?? null,
      managerId: e.managerId,
      managerName: e.managerId ? (managerName.get(e.managerId) ?? null) : null,
    }));
  }
}
