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
import { pendingAsNewManager, vnToday } from './transfer-rules';
import { OrganizationService } from '../organization/organization.service';
import { forbiddenFields, viewLevel } from './employee-access';
import { auditFields } from './employee-audit';
import { EmployeeSensitive } from './employee-sensitive.entity';
import { Employee } from './employee.entity';
import {
  CreateEmployeeDto,
  DirectoryEntry,
  EmployeeProfile,
  MaskedField,
  MeEmployee,
  PersonalSection,
  ProfileSectionData,
  ProfileSummary,
  UpdateEmployeeDto,
} from './employee.dto';
import { canReveal, canSeeLevel, findSection, relationTo, visibleSections } from './profile-sections';

export const FIELD_CRYPTO = Symbol('FIELD_CRYPTO');

export interface RequestMeta {
  ip?: string | null;
  traceId?: string | null;
}

const SENSITIVE_KEYS = ['nationalId', 'bankAccount', 'salary'] as const;
/** Trường chính HR sửa được; `employeeCode` không sửa (AC-1.4.4). */
const EDITABLE_KEYS = [
  'phone', 'address', 'fullName', 'dateOfBirth', 'workEmail', 'departmentId', 'positionId', 'managerId', 'status', 'hireDate',
] as const;


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

  async directory(params: { q?: string; dept?: string | string[]; managerId?: string; page: number; size: number }): Promise<Page<DirectoryEntry>> {
    const qb = this.repo
      .createQueryBuilder('e')
      .where("e.status <> 'TERMINATED'")
      .orderBy('e.full_name', 'ASC')
      .addOrderBy('e.id', 'ASC');
    if (Array.isArray(params.dept)) qb.andWhere('e.department_id IN (:...depts)', { depts: params.dept });
    else if (params.dept) qb.andWhere('e.department_id = :dept', { dept: params.dept });
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

  // ---------- Trang hồ sơ theo mục (UC1 spec 9.1) ----------

  /** Tài khoản đang đăng nhập: chỉ mã, tên của hồ sơ gắn với tài khoản (AC-1.8.7). */
  async meEmployee(employeeId: string): Promise<MeEmployee | null> {
    const e = await this.repo.findOne({
      where: { id: employeeId },
      select: { id: true, employeeCode: true, fullName: true },
    });
    return e ? { id: e.id, employeeCode: e.employeeCode, fullName: e.fullName } : null;
  }

  /** Phần trang hồ sơ mặc định hiện, cộng danh sách mục người xem được thấy (AC-1.8.1, 1.8.4, 1.8.7). */
  async summary(id: string, viewer: AuthUser): Promise<ProfileSummary> {
    const e = await this.getOrThrow(id);
    const relation = relationTo(viewer, e);
    const [entry] = await this.toDirectory([e]);
    // Nhãn "Chờ HR xác nhận" chỉ cho chủ hồ sơ và HR (AC-1.9.2).
    const pending =
      relation === 'OWNER' || relation === 'HR'
        ? new Map<string, number>(
            (
              (await this.repo.query(
                `SELECT section, count(*)::int AS n FROM employee.profile_change_request WHERE employee_id = $1 AND status = 'PENDING' GROUP BY section`,
                [id],
              )) as { section: string; n: number }[]
            ).map((r) => [r.section, r.n]),
          )
        : new Map<string, number>();
    const summary: ProfileSummary = {
      id: e.id,
      employeeCode: e.employeeCode,
      fullName: e.fullName,
      positionTitle: entry.positionTitle,
      departmentId: e.departmentId,
      departmentName: entry.departmentName,
      managerId: e.managerId,
      managerName: entry.managerName ?? null,
      phone: e.phone,
      workEmail: e.workEmail,
      relation,
      canEdit: relation === 'HR',
      hasAvatar: !!e.avatarFileId,
      sections: visibleSections(relation).map((s) => ({
        code: s.code,
        group: s.group,
        title: s.title,
        available: s.available,
        pendingRequests: pending.get(s.code) ?? 0,
      })),
    };
    // Hàng "Diện đối tượng" ở đầu trang có mức QL; hợp đồng chưa có dữ liệu (FR-1.12) nên luôn null.
    if (canSeeLevel(relation, 'QL')) summary.contractType = null;
    return summary;
  }

  /**
   * Dữ liệu của một mục, chỉ khi người dùng bấm vào mục đó (AC-1.8.8). Mục không tồn tại, chưa làm hoặc người xem không được
   * thấy đều trả 404 giống nhau (AC-1.8.6, E7). Giá trị nhạy cảm chỉ giải mã khi `reveal` và mỗi lần đều ghi audit.
   */
  async section(id: string, code: string, viewer: AuthUser, reveal: boolean, meta: RequestMeta = {}): Promise<ProfileSectionData> {
    const e = await this.getOrThrow(id);
    const relation = relationTo(viewer, e);
    const def = findSection(code);
    if (!def || !def.available || !canSeeLevel(relation, def.level)) {
      throw new NotFoundException('Không tìm thấy mục hồ sơ');
    }

    const field = code === 'salary' ? 'salary' : 'nationalId';
    const hasSensitive = code !== 'personal' || relation === 'HR';
    if (reveal && (!hasSensitive || !canReveal(relation, field))) {
      throw new ForbiddenException('Bạn không được xem giá trị này');
    }

    let masked: MaskedField | undefined;
    if (hasSensitive) {
      const s = await this.sensitiveRepo.findOneBy({ employeeId: id });
      const enc = field === 'salary' ? s?.salaryEnc : s?.nationalIdEnc;
      masked = { hasValue: !!enc, value: null };
      if (reveal) {
        masked.value = this.crypto.decrypt(enc);
        // NFR-6.1: mọi lượt đọc giá trị nhạy cảm đều có audit; chỉ ghi tên trường, không ghi giá trị.
        await this.audit.record({
          actorId: viewer.employeeId,
          action: 'VIEW_SENSITIVE',
          entityType: 'employee',
          entityId: id,
          changedFields: { fields: [field], section: code },
          ...meta,
        });
      }
    }

    if (code === 'salary') return { section: 'salary', salary: masked! };
    const personal: PersonalSection = {
      section: 'personal',
      relation,
      version: e.version,
      phone: e.phone,
      workEmail: e.workEmail,
      address: e.address,
      dateOfBirth: e.dateOfBirth,
      hireDate: e.hireDate,
      status: e.status,
    };
    if (masked) personal.nationalId = masked;
    return personal;
  }

  async update(id: string, dto: UpdateEmployeeDto, actor: AuthUser, meta: RequestMeta = {}): Promise<EmployeeProfile> {
    const denied = forbiddenFields(actor, id, dto);
    if (denied.length) throw new ForbiddenException(`Không được sửa: ${denied.join(', ')}`);

    await this.repo.manager.transaction(async (m) => {
      const repo = m.getRepository(Employee);
      const e = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!e) throw new NotFoundException('Không tìm thấy nhân viên');
      // AC-1.6.1, E3: version bắt buộc (DTO kiểm), lệch thì 409.
      if (dto.version !== e.version) {
        throw new ConflictException('Hồ sơ đã được người khác cập nhật, hãy tải lại');
      }

      // AC-2.7.7: đổi đơn vị, chức danh, quản lý chỉ qua "Điều chuyển" để luôn có dòng quá trình công tác và ngày hiệu lực.
      const orgChanged = (['departmentId', 'positionId', 'managerId'] as const).filter((k) => dto[k] !== undefined && dto[k] !== e[k]);
      if (orgChanged.length) {
        throw new BadRequestException({
          message: 'Đổi đơn vị, chức danh hoặc quản lý trực tiếp bằng "Điều chuyển" (có ngày hiệu lực); sửa nhầm thì chọn lý do "Điều chỉnh"',
          fields: Object.fromEntries(orgChanged.map((k) => [k, 'Dùng "Điều chuyển"'])),
        });
      }
      const lookups = await this.org.lookups();
      if (dto.departmentId && !lookups.department.has(dto.departmentId)) throw new BadRequestException('Phòng ban không tồn tại');
      if (dto.positionId && !lookups.position.has(dto.positionId)) throw new BadRequestException('Chức danh không tồn tại');
      // AC-2.6.2, AC-2.10.2: chỉ chặn khi đổi sang đơn vị ngừng hoạt động, chức danh ngừng dùng; người đang giữ không bị đổi.
      assertSelectable(
        lookups,
        dto.departmentId && dto.departmentId !== e.departmentId ? dto.departmentId : undefined,
        dto.positionId && dto.positionId !== e.positionId ? dto.positionId : undefined,
      );
      if (dto.managerId) await this.assertNoManagerCycle(m, id, dto.managerId);
      if (dto.positionId !== undefined || dto.managerId !== undefined) {
        await this.assertManagerRule(m, lookups, {
          employeeId: id,
          positionId: dto.positionId ?? e.positionId,
          managerId: dto.managerId !== undefined ? dto.managerId : e.managerId,
        });
      }
      // A4, E10 (AC-1.7.1): không cho nghỉ việc khi còn cấp dưới đang làm việc, để cây tổ chức không mất gốc nhánh.
      if (dto.status === 'TERMINATED' && e.status !== 'TERMINATED') {
        const reports = await repo.count({ where: { managerId: id, status: In(['ACTIVE', 'ON_LEAVE']) } });
        if (reports > 0) {
          throw new BadRequestException(
            `Nhân viên còn ${reports} cấp dưới đang làm việc. Hãy chuyển họ sang quản lý khác trước khi cho nghỉ việc`,
          );
        }
        // UC1 AC-1.7.3: là quản lý mới trong điều chuyển chưa hiệu lực của người khác thì HR phải sửa các điều chuyển đó trước.
        const pending = await pendingAsNewManager(m, id);
        if (pending.length) {
          throw new BadRequestException(
            `Nhân viên là quản lý mới trong ${pending.length} điều chuyển chưa hiệu lực (${pending.map((p) => `${p.employeeName} từ ${p.effectiveDate}`).join(', ')}). Hãy hủy hoặc sửa các điều chuyển đó trước`,
          );
        }
      }
      // AC-1.4.4: HR sửa được email công ty; email lưu chữ thường và không trùng.
      const workEmail = dto.workEmail?.toLowerCase();
      if (workEmail && workEmail !== e.workEmail && (await repo.exists({ where: { workEmail } }))) {
        throw new ConflictException('Email công ty đã được dùng cho nhân viên khác');
      }

      const changes: Partial<Employee> = {};
      const incoming = { ...dto, workEmail };
      for (const key of EDITABLE_KEYS) {
        if (incoming[key] !== undefined && incoming[key] !== e[key]) (changes as any)[key] = incoming[key];
      }
      const sensitiveChanged = SENSITIVE_KEYS.filter((k) => dto[k] !== undefined);
      if (!Object.keys(changes).length && !sensitiveChanged.length) return;

      if (sensitiveChanged.length) {
        const sRepo = m.getRepository(EmployeeSensitive);
        const current = (await sRepo.findOneBy({ employeeId: id })) ?? sRepo.create({ employeeId: id });
        if (dto.nationalId !== undefined) current.nationalIdEnc = this.crypto.encrypt(dto.nationalId);
        if (dto.bankAccount !== undefined) current.bankAccountEnc = this.crypto.encrypt(dto.bankAccount);
        if (dto.salary !== undefined) current.salaryEnc = this.crypto.encrypt(dto.salary);
        await sRepo.save(current);
      }
      if (Object.keys(changes).length) {
        await repo.save({ ...e, ...changes });
        // AC-2.9.8, UC1 AC-1.7.3: người nghỉ việc được gỡ khỏi vai trò trưởng, phó trong cùng giao dịch (có audit).
        if (changes.status === 'TERMINATED') {
          await this.org.removeRolesOf(id, actor, m);
          // UC1 AC-1.7.3: hủy điều chuyển chưa hiệu lực của người nghỉ; đóng giai đoạn công tác hiện tại.
          await m.query(`UPDATE employee.employment_assignment SET status = 'CANCELLED' WHERE employee_id = $1 AND status = 'SCHEDULED'`, [id]);
          await m.query(
            `UPDATE employee.employment_assignment SET status = 'CLOSED', effective_to = GREATEST(effective_from, $2::date) WHERE employee_id = $1 AND status = 'ACTIVE'`,
            [id, vnToday()],
          );
        }
      } else {
        // AC-1.6.3: chỉ đổi trường nhạy cảm vẫn tăng version, để người đang mở form cũ nhận 409.
        await repo.increment({ id }, 'version', 1);
      }
      // AC-1.4.3: trường tổ chức ghi giá trị cũ và mới; trường cá nhân, nhạy cảm chỉ ghi tên.
      const changedFields = auditFields(
        { ...changes, ...Object.fromEntries(sensitiveChanged.map((k) => [k, true])) },
        e as unknown as Record<string, unknown>,
      );
      await this.audit.record(
        { actorId: actor.employeeId, action: 'UPDATE', entityType: 'employee', entityId: id, changedFields, ...meta },
        m,
      );
    });
    return this.profile(id, actor, false);
  }

  async create(dto: CreateEmployeeDto, actor: AuthUser, meta: RequestMeta = {}): Promise<EmployeeProfile> {
    const lookups = await this.org.lookups();
    if (!lookups.department.has(dto.departmentId)) throw new BadRequestException('Phòng ban không tồn tại');
    if (!lookups.position.has(dto.positionId)) throw new BadRequestException('Chức danh không tồn tại');
    assertSelectable(lookups, dto.departmentId, dto.positionId);
    if (dto.managerId) await this.getOrThrow(dto.managerId);

    const { nationalId, bankAccount, salary, ...plain } = dto;
    const sensitiveGiven = SENSITIVE_KEYS.filter((k) => dto[k] !== undefined);
    const id = await this.repo.manager.transaction(async (m) => {
      await this.assertManagerRule(m, lookups, { positionId: dto.positionId, managerId: dto.managerId ?? null });
      const saved = await m.getRepository(Employee).save(
        m.getRepository(Employee).create({ ...plain, workEmail: dto.workEmail.toLowerCase(), managerId: dto.managerId ?? null }),
      );
      // AC-2.8.3: dòng đầu tiên của quá trình công tác, mở từ ngày vào làm.
      await m.query(
        `INSERT INTO employee.employment_assignment (employee_id, department_id, position_id, manager_id, effective_from, reason, status, created_by, applied_at)
         VALUES ($1, $2, $3, $4, $5, 'HIRE', 'ACTIVE', $6, now())`,
        [saved.id, saved.departmentId, saved.positionId, saved.managerId, saved.hireDate, actor.employeeId],
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
      // AC-1.4.3: trường tổ chức ghi giá trị; trường cá nhân, nhạy cảm chỉ ghi tên.
      const changedFields = auditFields({ ...plain, ...Object.fromEntries(sensitiveGiven.map((k) => [k, true])) }, null);
      await this.audit.record(
        { actorId: actor.employeeId, action: 'CREATE', entityType: 'employee', entityId: saved.id, changedFields, ...meta },
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
  async assertManagerRule(
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
  async assertNoManagerCycle(m: EntityManager, employeeId: string, managerId: string) {
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

/** Đơn vị phải đang hoạt động, chức danh phải đang dùng khi chọn mới (AC-2.6.2, AC-2.10.2). */
function assertSelectable(
  lookups: { department: Map<string, { status: string }>; position: Map<string, { active: boolean }> },
  departmentId?: string,
  positionId?: string,
) {
  if (departmentId && lookups.department.get(departmentId)?.status !== 'ACTIVE') {
    throw new BadRequestException('Đơn vị đã ngừng hoạt động');
  }
  if (positionId && lookups.position.get(positionId)?.active === false) throw new BadRequestException('Chức danh đã ngừng dùng');
}
