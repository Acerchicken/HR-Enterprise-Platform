import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, Repository } from 'typeorm';
import { FieldCrypto } from '../../common/field-crypto';
import { Page } from '../../common/pagination';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../identity/roles';
import { OrganizationService } from '../organization/organization.service';
import { EmployeeSensitive } from './employee-sensitive.entity';
import { Employee } from './employee.entity';
import { FIELD_CRYPTO, RequestMeta } from './employee.service';
import { ChangeAction, ProfileChangeRequest, ProfileItem } from './profile-change.entity';
import { ProfileEventType } from './profile-events';
import { FieldSpec, SECTION_SCHEMAS, SectionSchema, validateSection } from './profile-schema';
import { canSeeLevel, findSection, relationTo } from './profile-sections';

/** Mỗi nhân viên tối đa 20 yêu cầu đang chờ (AC-1.9.7, E21). */
export const MAX_PENDING = 20;
/** Yêu cầu chờ quá 2 ngày làm việc là quá hạn (AC-1.9.13, A10). */
export const OVERDUE_WORKDAYS = 2;

export interface SubmitInput {
  section: string;
  action: ChangeAction;
  itemId?: string | null;
  baseVersion?: number | null;
  proposed?: Record<string, unknown>;
}

export interface MaskedValue {
  hasValue: boolean;
  value: string | null;
}

export interface RowView {
  id: string | null;
  version: number;
  data: Record<string, unknown>;
  sensitive: Record<string, MaskedValue>;
}

export interface RequestView {
  id: string;
  employeeId: string;
  section: string;
  action: ChangeAction;
  itemId: string | null;
  baseVersion: number | null;
  status: string;
  proposed: Record<string, unknown>;
  /** Tên trường nhạy cảm có trong đề xuất; giá trị chỉ có ở chi tiết khi HR bấm mắt. */
  proposedSensitive: Record<string, MaskedValue>;
  submittedAt: Date;
  reviewedAt: Date | null;
  rejectReason?: string | null;
}

/** Số ngày làm việc (thứ Hai → thứ Sáu) giữa hai thời điểm, không tính ngày lễ. */
export function workdaysBetween(from: Date, to: Date): number {
  let days = 0;
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  while (d < end) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) days++;
  }
  return days;
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Yêu cầu cập nhật hồ sơ (UC1 FR-1.9), các mục nhiều dòng, HR sửa trực tiếp mục (A9) và nhật ký thay đổi (FR-1.11).
 * Duyệt yêu cầu và HR sửa trực tiếp dùng chung `applyChange`, nên kiểm dữ liệu, mã hóa, `version` chỉ viết một lần (spec 13.1).
 */
@Injectable()
export class ProfileChangeService {
  constructor(
    @InjectRepository(Employee) private readonly employees: Repository<Employee>,
    @InjectRepository(ProfileItem) private readonly items: Repository<ProfileItem>,
    @InjectRepository(ProfileChangeRequest) private readonly requests: Repository<ProfileChangeRequest>,
    private readonly audit: AuditService,
    private readonly org: OrganizationService,
    @Inject(FIELD_CRYPTO) private readonly crypto: FieldCrypto,
  ) {}

  // ---------- Đọc ----------

  /** Số yêu cầu đang chờ theo mục, cho nhãn "Chờ HR xác nhận" ở trang hồ sơ (chỉ chủ hồ sơ và HR thấy). */
  async pendingCounts(employeeId: string): Promise<Map<string, number>> {
    const rows: { section: string; n: string }[] = await this.requests.query(
      `SELECT section, count(*) AS n FROM employee.profile_change_request WHERE employee_id = $1 AND status = 'PENDING' GROUP BY section`,
      [employeeId],
    );
    return new Map(rows.map((r) => [r.section, Number(r.n)]));
  }

  /** Yêu cầu đang chờ và yêu cầu bị từ chối chưa đóng của một mục (AC-1.9.2). Người khác (kể cả quản lý) không thấy. */
  async openRequests(employeeId: string, section: string): Promise<RequestView[]> {
    const list = await this.requests.find({
      where: [
        { employeeId, section, status: 'PENDING' },
        { employeeId, section, status: 'REJECTED', acknowledgedAt: IsNull() },
      ],
      order: { submittedAt: 'ASC' },
    });
    return list.map((r) => this.view(r, true));
  }

  /** Mục nhiều dòng hoặc một dòng (liên hệ khẩn cấp, thân nhân, chuyên môn, tài khoản ngân hàng). */
  async readSection(employeeId: string, code: string, viewer: AuthUser, reveal: boolean, meta: RequestMeta = {}) {
    const e = await this.employees.findOneBy({ id: employeeId });
    if (!e) throw new NotFoundException('Không tìm thấy nhân viên');
    const relation = relationTo(viewer, e);
    const def = findSection(code);
    const schema = SECTION_SCHEMAS[code];
    if (!def || !def.available || !schema || schema.kind === 'main' || !canSeeLevel(relation, def.level)) {
      throw new NotFoundException('Không tìm thấy mục hồ sơ');
    }
    const sensitiveKeys = schema.fields.filter((f) => f.sensitive).map((f) => f.key);
    if (reveal && !sensitiveKeys.length) throw new BadRequestException('Mục này không có giá trị nhạy cảm');
    // NC (tài khoản ngân hàng) và trường nhạy cảm của dòng: chỉ chủ hồ sơ và HR giải mã.
    if (reveal && relation !== 'OWNER' && relation !== 'HR') throw new ForbiddenException('Bạn không được xem giá trị này');

    const rows = await this.rowsOf(employeeId, code, schema, reveal);
    if (reveal && rows.some((r) => Object.values(r.sensitive).some((v) => v.hasValue))) {
      await this.audit.record({
        actorId: viewer.employeeId,
        action: 'VIEW_SENSITIVE',
        entityType: 'employee',
        entityId: employeeId,
        changedFields: { fields: sensitiveKeys, section: code },
        ...meta,
      });
    }
    const own = relation === 'OWNER' || relation === 'HR';
    return {
      section: code,
      kind: schema.kind,
      maxRows: schema.maxRows,
      notice: schema.notice ?? null,
      fields: schema.fields,
      canPropose: relation === 'OWNER',
      canEdit: relation === 'HR',
      rows,
      requests: own ? await this.openRequests(employeeId, code) : [],
    };
  }

  private async rowsOf(employeeId: string, code: string, schema: SectionSchema, reveal: boolean): Promise<RowView[]> {
    const list = await this.items.find({
      where: { employeeId, section: code, deletedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });
    const keys = schema.fields.filter((f) => f.sensitive).map((f) => f.key);
    const rows = list.map((it) => {
      const dec = reveal && it.sensitiveData ? (JSON.parse(this.crypto.decrypt(it.sensitiveData) ?? '{}') as Record<string, string>) : null;
      const stored = it.sensitiveData ? (JSON.parse(this.crypto.decrypt(it.sensitiveData) ?? '{}') as Record<string, string>) : {};
      return {
        id: it.id,
        version: it.version,
        data: it.data,
        sensitive: Object.fromEntries(keys.map((k) => [k, { hasValue: !!stored[k], value: dec ? (dec[k] ?? null) : null }])),
      };
    });
    if (code !== 'bank-account') return rows;
    // Tài khoản ngân hàng: số tài khoản lưu ở employee_sensitive (dữ liệu có từ trước, HR vẫn sửa được ở form hồ sơ).
    const s = await this.items.manager.getRepository(EmployeeSensitive).findOneBy({ employeeId });
    const account = s?.bankAccountEnc ?? null;
    const row: RowView = rows[0] ?? { id: null, version: 0, data: {}, sensitive: {} };
    row.sensitive = { accountNumber: { hasValue: !!account, value: reveal ? this.crypto.decrypt(account) : null } };
    return row.id || account ? [row] : [];
  }

  // ---------- Nhân viên gửi, hủy yêu cầu ----------

  async submit(employeeId: string, input: SubmitInput, viewer: AuthUser, idempotencyKey: string | undefined, meta: RequestMeta = {}) {
    if (!idempotencyKey || idempotencyKey.length > 100) throw new BadRequestException('Thiếu header Idempotency-Key');
    const e = await this.employees.findOneBy({ id: employeeId });
    if (!e) throw new NotFoundException('Không tìm thấy nhân viên');
    // E1, AC-1.9.8: chỉ chủ hồ sơ gửi yêu cầu, chỉ cho mục có cột "Nhập" là NV. HR sửa trực tiếp, không qua yêu cầu.
    if (relationTo(viewer, e) !== 'OWNER' || !viewer.employeeId) throw new ForbiddenException('Chỉ chủ hồ sơ gửi được yêu cầu cập nhật');
    const schema = SECTION_SCHEMAS[input.section];
    if (!schema) throw new ForbiddenException('Mục này do HR quản lý, nhân viên không gửi yêu cầu được');

    // A7, AC-1.9.12: gửi lại cùng Idempotency-Key thì trả yêu cầu đã tạo.
    const again = await this.requests.findOneBy({ submittedBy: viewer.employeeId, idempotencyKey });
    if (again) return this.view(again, true);

    const action = input.action;
    if (schema.kind !== 'rows' && action !== 'UPDATE') throw new BadRequestException('Mục này chỉ cho phép sửa');
    if (schema.kind === 'rows' && action !== 'CREATE' && !input.itemId) throw new BadRequestException('Thiếu itemId của dòng cần sửa, xóa');
    if (schema.kind === 'rows' && action === 'CREATE' && input.itemId) throw new BadRequestException('Thêm dòng mới không kèm itemId');

    let data: Record<string, unknown> = {};
    let sensitive: Record<string, string> = {};
    if (action !== 'DELETE') {
      const v = validateSection(input.section, input.proposed ?? {}, today(), schema.kind === 'main');
      if (Object.keys(v.errors).length) throw new BadRequestException({ message: Object.values(v.errors), fields: v.errors });
      data = v.data;
      sensitive = v.sensitive;
      if (!Object.keys(data).length && !Object.keys(sensitive).length) throw new BadRequestException('Không có thay đổi nào');
    }

    return this.requests.manager.transaction(async (m) => {
      // Khóa theo nhân viên để đếm số dòng, số yêu cầu đúng khi gửi đồng thời.
      await m.query('SELECT id FROM employee.employee WHERE id = $1 FOR UPDATE', [employeeId]);
      const reqRepo = m.getRepository(ProfileChangeRequest);

      let itemId: string | null = null;
      let baseVersion: number;
      if (schema.kind === 'main') {
        baseVersion = (await m.getRepository(Employee).findOneByOrFail({ id: employeeId })).version;
      } else if (schema.kind === 'single') {
        const item = await m.getRepository(ProfileItem).findOneBy({ employeeId, section: input.section, deletedAt: IsNull() });
        itemId = item?.id ?? null;
        baseVersion = item?.version ?? 0;
      } else if (action === 'CREATE') {
        baseVersion = 0;
        const rows = await m.getRepository(ProfileItem).countBy({ employeeId, section: input.section, deletedAt: IsNull() });
        const pendingCreates = await reqRepo.countBy({ employeeId, section: input.section, action: 'CREATE', status: 'PENDING' });
        if (rows + pendingCreates + 1 > schema.maxRows) {
          throw new ConflictException(`Mục này tối đa ${schema.maxRows} dòng (tính cả yêu cầu đang chờ)`);
        }
      } else {
        const item = await m.getRepository(ProfileItem).findOneBy({ id: input.itemId!, employeeId, section: input.section, deletedAt: IsNull() });
        if (!item) throw new NotFoundException('Không tìm thấy dòng cần sửa');
        itemId = item.id;
        baseVersion = input.baseVersion ?? item.version;
      }

      // AC-1.9.7: cùng chỗ đã có yêu cầu đang chờ thì yêu cầu cũ bị thay.
      if (schema.kind !== 'rows' || action !== 'CREATE') {
        await reqRepo.update(
          itemId ? { employeeId, section: input.section, itemId, status: 'PENDING' } : { employeeId, section: input.section, itemId: IsNull(), action: 'UPDATE', status: 'PENDING' },
          { status: 'CANCELLED' },
        );
      }
      if ((await reqRepo.countBy({ employeeId, status: 'PENDING' })) >= MAX_PENDING) {
        throw new ConflictException(`Bạn đã có ${MAX_PENDING} yêu cầu đang chờ HR xác nhận, hãy chờ HR xử lý bớt`);
      }

      const saved = await reqRepo.save(
        reqRepo.create({
          employeeId,
          section: input.section,
          action,
          itemId,
          baseVersion,
          proposed: data,
          proposedSensitive: Object.keys(sensitive).length ? this.crypto.encrypt(JSON.stringify(sensitive)) : null,
          submittedBy: viewer.employeeId!,
          idempotencyKey,
        }),
      );
      const fields = [...Object.keys(data), ...Object.keys(sensitive)];
      await this.audit.record(
        {
          actorId: viewer.employeeId,
          action: 'PROFILE_CHANGE_SUBMIT',
          entityType: 'employee',
          entityId: employeeId,
          changedFields: { section: input.section, requestId: saved.id, action, itemId, fields },
          ...meta,
        },
        m,
      );
      await this.outbox(m, 'ProfileChangeSubmitted', saved);
      return this.view(saved, true);
    });
  }

  async cancel(employeeId: string, requestId: string, viewer: AuthUser, meta: RequestMeta = {}) {
    await this.requests.manager.transaction(async (m) => {
      const r = await m.getRepository(ProfileChangeRequest).findOne({ where: { id: requestId, employeeId }, lock: { mode: 'pessimistic_write' } });
      if (!r || r.submittedBy !== viewer.employeeId) throw new NotFoundException('Không tìm thấy yêu cầu');
      if (r.status !== 'PENDING') throw new ConflictException('Yêu cầu không còn chờ xác nhận');
      await m.getRepository(ProfileChangeRequest).update(r.id, { status: 'CANCELLED' });
      await this.audit.record(
        {
          actorId: viewer.employeeId,
          action: 'PROFILE_CHANGE_CANCEL',
          entityType: 'employee',
          entityId: employeeId,
          changedFields: { section: r.section, requestId: r.id, action: r.action, fields: this.fieldNames(r) },
          ...meta,
        },
        m,
      );
    });
  }

  /** Nhân viên đóng thông báo bị từ chối (spec 9.1). */
  async acknowledge(employeeId: string, requestId: string, viewer: AuthUser) {
    const r = await this.requests.findOneBy({ id: requestId, employeeId });
    if (!r || r.submittedBy !== viewer.employeeId) throw new NotFoundException('Không tìm thấy yêu cầu');
    if (r.status === 'REJECTED' && !r.acknowledgedAt) await this.requests.update(r.id, { acknowledgedAt: new Date() });
  }

  // ---------- HR xem, duyệt, từ chối ----------

  async list(q: { status?: string; section?: string; departmentId?: string; page: number; size: number }): Promise<Page<RequestView & { employeeName: string; employeeCode: string; departmentName: string | null; overdue: boolean }>> {
    const qb = this.requests
      .createQueryBuilder('r')
      .innerJoin(Employee, 'e', 'e.id = r.employeeId')
      .where('r.status = :status', { status: q.status ?? 'PENDING' })
      .orderBy('r.submittedAt', 'ASC');
    if (q.section) qb.andWhere('r.section = :section', { section: q.section });
    if (q.departmentId) qb.andWhere('e.departmentId = :dept', { dept: q.departmentId });
    const [list, total] = await qb.skip((q.page - 1) * q.size).take(q.size).getManyAndCount();
    const emps = list.length ? await this.employees.findBy({ id: In(list.map((r) => r.employeeId)) }) : [];
    const lookups = await this.org.lookups();
    const byId = new Map(emps.map((e) => [e.id, e]));
    const now = new Date();
    return {
      items: list.map((r) => {
        const e = byId.get(r.employeeId);
        return {
          ...this.view(r, false),
          employeeName: e?.fullName ?? '',
          employeeCode: e?.employeeCode ?? '',
          departmentName: e ? (lookups.department.get(e.departmentId)?.name ?? null) : null,
          overdue: r.status === 'PENDING' && workdaysBetween(r.submittedAt, now) > OVERDUE_WORKDAYS,
        };
      }),
      page: q.page,
      size: q.size,
      total,
    };
  }

  /** Số yêu cầu đang chờ toàn công ty (số trên ô "Việc cần duyệt" của HR). */
  countPending(): Promise<number> {
    return this.requests.countBy({ status: 'PENDING' });
  }

  /** Chi tiết: giá trị hiện tại và đề xuất cạnh nhau (AC-1.9.3). Giá trị nhạy cảm chỉ có khi HR bấm mắt (có audit). */
  async detail(requestId: string, viewer: AuthUser, reveal: boolean, meta: RequestMeta = {}) {
    const r = await this.requests.findOneBy({ id: requestId });
    const isHr = viewer.roles.includes('HR');
    if (!r || (!isHr && r.submittedBy !== viewer.employeeId)) throw new NotFoundException('Không tìm thấy yêu cầu');
    if (reveal && !isHr) throw new ForbiddenException('Chỉ HR xem giá trị nhạy cảm của yêu cầu');
    const e = await this.employees.findOneByOrFail({ id: r.employeeId });
    const schema = SECTION_SCHEMAS[r.section];
    let current: Record<string, unknown> = {};
    let currentSensitive: Record<string, MaskedValue> = {};
    if (schema?.kind === 'main') {
      current = Object.fromEntries(Object.keys(r.proposed).map((k) => [k, (e as unknown as Record<string, unknown>)[k] ?? null]));
    } else if (schema) {
      const row = (await this.rowsOf(r.employeeId, r.section, schema, reveal)).find((x) => x.id === r.itemId || (schema.kind === 'single' && !r.itemId));
      current = row?.data ?? {};
      currentSensitive = row?.sensitive ?? {};
    }
    const view = this.view(r, true);
    if (reveal) {
      const dec = r.proposedSensitive ? (JSON.parse(this.crypto.decrypt(r.proposedSensitive) ?? '{}') as Record<string, string>) : {};
      view.proposedSensitive = Object.fromEntries(Object.keys(dec).map((k) => [k, { hasValue: true, value: dec[k] ?? null }]));
      await this.audit.record({
        actorId: viewer.employeeId,
        action: 'VIEW_SENSITIVE',
        entityType: 'employee',
        entityId: r.employeeId,
        changedFields: { fields: Object.keys(dec), section: r.section, requestId: r.id },
        ...meta,
      });
    }
    const lookups = await this.org.lookups();
    return {
      ...view,
      employee: { id: e.id, fullName: e.fullName, employeeCode: e.employeeCode, departmentName: lookups.department.get(e.departmentId)?.name ?? null },
      fields: schema?.fields ?? [],
      current,
      currentSensitive,
      overdue: r.status === 'PENDING' && workdaysBetween(r.submittedAt, new Date()) > OVERDUE_WORKDAYS,
    };
  }

  async approve(requestId: string, hr: AuthUser, meta: RequestMeta = {}) {
    return this.requests.manager.transaction(async (m) => {
      const repo = m.getRepository(ProfileChangeRequest);
      const r = await repo.findOne({ where: { id: requestId }, lock: { mode: 'pessimistic_write' } });
      if (!r) throw new NotFoundException('Không tìm thấy yêu cầu');
      // E20: duyệt lặp lại yêu cầu đã duyệt thì trả lại, không ghi lần hai.
      if (r.status === 'APPROVED') return this.view(r, true);
      if (r.status !== 'PENDING') throw new ConflictException('Yêu cầu không còn chờ xác nhận');
      const sensitive = r.proposedSensitive ? (JSON.parse(this.crypto.decrypt(r.proposedSensitive) ?? '{}') as Record<string, string>) : {};
      await this.applyChange(m, {
        employeeId: r.employeeId,
        section: r.section,
        action: r.action,
        itemId: r.itemId,
        baseVersion: r.baseVersion,
        data: r.proposed,
        sensitive,
        actorId: hr.employeeId,
        changeRequestId: r.id,
      });
      r.status = 'APPROVED';
      r.reviewedBy = hr.employeeId;
      r.reviewedAt = new Date();
      await repo.save(r);
      await this.audit.record(
        {
          actorId: hr.employeeId,
          action: 'PROFILE_CHANGE_APPROVE',
          entityType: 'employee',
          entityId: r.employeeId,
          changedFields: { section: r.section, requestId: r.id, action: r.action, fields: this.fieldNames(r, sensitive) },
          ...meta,
        },
        m,
      );
      await this.outbox(m, 'ProfileChangeDecided', r);
      // A5, AC-1.9.10: đổi tài khoản ngân hàng thì báo riêng để phát hiện yêu cầu không phải do mình gửi.
      if (r.section === 'bank-account') await this.outbox(m, 'BankAccountChanged', r);
      return this.view(r, true);
    });
  }

  async reject(requestId: string, reason: string, hr: AuthUser, meta: RequestMeta = {}) {
    return this.requests.manager.transaction(async (m) => {
      const repo = m.getRepository(ProfileChangeRequest);
      const r = await repo.findOne({ where: { id: requestId }, lock: { mode: 'pessimistic_write' } });
      if (!r) throw new NotFoundException('Không tìm thấy yêu cầu');
      if (r.status !== 'PENDING') throw new ConflictException('Yêu cầu không còn chờ xác nhận');
      r.status = 'REJECTED';
      r.reviewedBy = hr.employeeId;
      r.reviewedAt = new Date();
      r.rejectReason = reason;
      await repo.save(r);
      // Audit không chứa lý do từ chối (AC-1.9.5).
      await this.audit.record(
        {
          actorId: hr.employeeId,
          action: 'PROFILE_CHANGE_REJECT',
          entityType: 'employee',
          entityId: r.employeeId,
          changedFields: { section: r.section, requestId: r.id, action: r.action, fields: this.fieldNames(r) },
          ...meta,
        },
        m,
      );
      await this.outbox(m, 'ProfileChangeDecided', r);
      return this.view(r, true);
    });
  }

  // ---------- HR sửa trực tiếp mục (A9) ----------

  async hrWrite(
    employeeId: string,
    section: string,
    action: ChangeAction,
    itemId: string | null,
    body: { version?: number; data?: Record<string, unknown> },
    hr: AuthUser,
    meta: RequestMeta = {},
  ) {
    const schema = SECTION_SCHEMAS[section];
    if (!schema || schema.kind === 'main') throw new NotFoundException('Không tìm thấy mục hồ sơ');
    if (!(await this.employees.existsBy({ id: employeeId }))) throw new NotFoundException('Không tìm thấy nhân viên');
    let data: Record<string, unknown> = {};
    let sensitive: Record<string, string> = {};
    if (action !== 'DELETE') {
      const v = validateSection(section, body.data ?? {}, today());
      if (Object.keys(v.errors).length) throw new BadRequestException({ message: Object.values(v.errors), fields: v.errors });
      data = v.data;
      sensitive = v.sensitive;
    }
    if (action !== 'CREATE' && body.version === undefined) throw new BadRequestException('Thiếu version của dòng');
    await this.items.manager.transaction(async (m) => {
      if (action === 'CREATE' && schema.kind === 'rows') {
        const rows = await m.getRepository(ProfileItem).countBy({ employeeId, section, deletedAt: IsNull() });
        if (rows + 1 > schema.maxRows) throw new ConflictException(`Mục này tối đa ${schema.maxRows} dòng`);
      }
      const id = await this.applyChange(m, {
        employeeId,
        section,
        action,
        itemId: schema.kind === 'single' ? ((await m.getRepository(ProfileItem).findOneBy({ employeeId, section, deletedAt: IsNull() }))?.id ?? null) : itemId,
        baseVersion: action === 'CREATE' ? 0 : body.version!,
        data,
        sensitive,
        actorId: hr.employeeId,
        changeRequestId: null,
      });
      const auditAction = { CREATE: 'PROFILE_ITEM_CREATE', UPDATE: 'PROFILE_ITEM_UPDATE', DELETE: 'PROFILE_ITEM_DELETE' }[action];
      await this.audit.record(
        {
          actorId: hr.employeeId,
          action: auditAction,
          entityType: 'employee',
          entityId: employeeId,
          changedFields: { section, itemId: id, fields: [...Object.keys(data), ...Object.keys(sensitive)] },
          ...meta,
        },
        m,
      );
    });
  }

  /**
   * Ghi một thay đổi vào hồ sơ hoặc dòng, kiểm `version` gốc (E19), tăng `version`. Dùng cho cả duyệt yêu cầu và HR sửa trực
   * tiếp. Trả id dòng.
   */
  private async applyChange(
    m: EntityManager,
    c: {
      employeeId: string;
      section: string;
      action: ChangeAction;
      itemId: string | null;
      baseVersion: number | null;
      data: Record<string, unknown>;
      sensitive: Record<string, string>;
      actorId: string | null;
      changeRequestId: string | null;
    },
  ): Promise<string | null> {
    const schema = SECTION_SCHEMAS[c.section]!;
    const stale = () => new ConflictException('Dữ liệu đã thay đổi sau khi gửi yêu cầu; hãy từ chối hoặc để nhân viên gửi lại');

    if (schema.kind === 'main') {
      const repo = m.getRepository(Employee);
      const e = await repo.findOne({ where: { id: c.employeeId }, lock: { mode: 'pessimistic_write' } });
      if (!e) throw new NotFoundException('Không tìm thấy nhân viên');
      if (c.baseVersion !== null && e.version !== c.baseVersion) throw stale();
      Object.assign(e, c.data);
      await repo.save(e);
      return null;
    }

    const repo = m.getRepository(ProfileItem);
    const item = c.itemId
      ? await repo.findOne({ where: { id: c.itemId, employeeId: c.employeeId, section: c.section }, lock: { mode: 'pessimistic_write' } })
      : null;
    if (c.itemId && (!item || item.deletedAt)) throw new NotFoundException('Không tìm thấy dòng');
    const current = item ? item.version : 0;
    if (c.action !== 'CREATE' && c.baseVersion !== null && current !== c.baseVersion) throw stale();

    if (c.section === 'bank-account' && c.sensitive.accountNumber) {
      const sRepo = m.getRepository(EmployeeSensitive);
      const s = (await sRepo.findOneBy({ employeeId: c.employeeId })) ?? sRepo.create({ employeeId: c.employeeId });
      s.bankAccountEnc = this.crypto.encrypt(c.sensitive.accountNumber);
      await sRepo.save(s);
    }
    const keepSensitive = c.section === 'bank-account' ? {} : c.sensitive;
    const enc = (old: string | null) => {
      if (!Object.keys(keepSensitive).length) return old;
      const prev = old ? (JSON.parse(this.crypto.decrypt(old) ?? '{}') as Record<string, string>) : {};
      return this.crypto.encrypt(JSON.stringify({ ...prev, ...keepSensitive }));
    };

    if (c.action === 'DELETE') {
      item!.deletedAt = new Date();
      item!.updatedBy = c.actorId;
      item!.changeRequestId = c.changeRequestId;
      await repo.save(item!);
      return item!.id;
    }
    if (!item) {
      const created = await repo.save(
        repo.create({
          employeeId: c.employeeId,
          section: c.section,
          data: c.data,
          sensitiveData: enc(null),
          createdBy: c.actorId,
          updatedBy: c.actorId,
          changeRequestId: c.changeRequestId,
        }),
      );
      return created.id;
    }
    item.data = schema.kind === 'single' ? { ...item.data, ...c.data } : c.data;
    // Người phụ thuộc chuyển thành không phải người phụ thuộc thì bỏ mã số thuế đã lưu.
    item.sensitiveData = c.section === 'relatives' && c.data.isDependent === false ? null : enc(item.sensitiveData);
    item.updatedBy = c.actorId;
    item.changeRequestId = c.changeRequestId;
    await repo.save(item);
    return item.id;
  }

  // ---------- Nhật ký thay đổi (FR-1.11) ----------

  async history(
    employeeId: string,
    viewer: AuthUser,
    q: { section?: string; actorId?: string; from?: Date; to?: Date; page: number; size: number },
  ) {
    const e = await this.employees.findOneBy({ id: employeeId });
    if (!e) throw new NotFoundException('Không tìm thấy nhân viên');
    const relation = relationTo(viewer, e);
    // AC-1.11.2: chỉ chủ hồ sơ và HR; quản lý trực tiếp, người khác 403.
    if (relation !== 'OWNER' && relation !== 'HR') throw new ForbiddenException('Chỉ chủ hồ sơ và HR xem lịch sử thay đổi');
    const page = await this.audit.history({ entityType: 'employee', entityId: employeeId, ...q, actions: HISTORY_ACTIONS });
    const actorIds = [...new Set(page.items.map((a) => a.actorId).filter((x): x is string => !!x))];
    const names = actorIds.length
      ? new Map((await this.employees.find({ where: { id: In(actorIds) }, select: { id: true, fullName: true } })).map((x) => [x.id, x.fullName]))
      : new Map<string, string>();
    return {
      ...page,
      items: page.items.map((a) => {
        const cf = (a.changedFields ?? {}) as Record<string, unknown>;
        const fields = Array.isArray(cf.fields) ? (cf.fields as string[]) : Object.keys(cf).filter((k) => !HISTORY_META.has(k));
        // Không trả giá trị nào (AC-1.11.1), chỉ tên trường.
        return {
          at: a.at,
          actorId: a.actorId,
          actorName: a.actorId ? (names.get(a.actorId) ?? null) : null,
          action: a.action,
          section: (cf.section as string) ?? (a.action === 'UPDATE' || a.action === 'CREATE' ? 'personal' : null),
          fields,
        };
      }),
    };
  }

  // ---------- Nội bộ ----------

  private view(r: ProfileChangeRequest, withReason: boolean): RequestView {
    const keys = r.proposedSensitive ? Object.keys(JSON.parse(this.crypto.decrypt(r.proposedSensitive) ?? '{}')) : [];
    return {
      id: r.id,
      employeeId: r.employeeId,
      section: r.section,
      action: r.action,
      itemId: r.itemId,
      baseVersion: r.baseVersion,
      status: r.status,
      proposed: r.proposed,
      proposedSensitive: Object.fromEntries(keys.map((k) => [k, { hasValue: true, value: null }])),
      submittedAt: r.submittedAt,
      reviewedAt: r.reviewedAt,
      ...(withReason ? { rejectReason: r.rejectReason } : {}),
    };
  }

  private fieldNames(r: ProfileChangeRequest, sensitive?: Record<string, string>): string[] {
    const s = sensitive ?? (r.proposedSensitive ? JSON.parse(this.crypto.decrypt(r.proposedSensitive) ?? '{}') : {});
    return [...Object.keys(r.proposed), ...Object.keys(s)];
  }

  /** Event cho worker gửi email (outbox dùng chung `leave.outbox`, ghi cùng giao dịch). Payload không có giá trị hồ sơ. */
  private async outbox(m: EntityManager, type: ProfileEventType, r: ProfileChangeRequest) {
    await m.query(`INSERT INTO leave.outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)`, [
      type,
      r.id,
      JSON.stringify({ requestId: r.id, employeeId: r.employeeId, section: r.section, status: r.status, occurredAt: new Date().toISOString() }),
    ]);
  }
}

const HISTORY_ACTIONS = [
  'CREATE',
  'UPDATE',
  'VIEW_SENSITIVE',
  'PROFILE_CHANGE_SUBMIT',
  'PROFILE_CHANGE_CANCEL',
  'PROFILE_CHANGE_APPROVE',
  'PROFILE_CHANGE_REJECT',
  'PROFILE_ITEM_CREATE',
  'PROFILE_ITEM_UPDATE',
  'PROFILE_ITEM_DELETE',
  'PROFILE_FILE_UPLOAD',
  'PROFILE_FILE_DELETE',
  'PROFILE_FILE_DOWNLOAD',
];
const HISTORY_META = new Set(['section', 'requestId', 'itemId', 'action', 'fields']);

export type { FieldSpec };
