import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { FieldCrypto } from '../../common/field-crypto';
import { Page } from '../../common/pagination';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../identity/roles';
import { OrganizationService } from '../organization/organization.service';
import { EmployeeSensitive } from './employee-sensitive.entity';
import { Employee } from './employee.entity';
import { FIELD_CRYPTO, RequestMeta } from './employee.service';
import { ChangeAction, ProfileChangeRequest, ProfileFile, ProfileItem } from './profile-change.entity';
import { FileView, fileView, ProfileFileService } from './profile-file.service';
import { ProfileEventType } from './profile-events';
import { onLeavePeriods, seniority } from './profile-computed';
import { CONTRACT_LABEL, FieldSpec, SECTION_SCHEMAS, SectionSchema, validateSection } from './profile-schema';
import { canSeeLevel, findSection, relationTo, resolveRelation } from './profile-sections';

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
  /** File đã tải lên (luồng 4.3) gắn vào yêu cầu; với mục chỉ gồm file và thao tác DELETE là file cần xóa. */
  fileIds?: string[];
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
  files?: FileView[];
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
  /** `TERMINATED`: hệ thống hủy vì chủ hồ sơ nghỉ việc (UC1 E29). */
  cancelReason: string | null;
  fileIds: string[];
  files?: FileView[];
}

/** Mức đang hiệu lực: dòng có ngày hiệu lực muộn nhất nhưng không sau hôm nay. */
export function currentRow<T extends { data: Record<string, unknown> }>(rows: T[], on = new Date().toISOString().slice(0, 10)): T | undefined {
  return rows
    .filter((r) => String(r.data.effectiveDate) <= on)
    .sort((a, b) => String(b.data.effectiveDate).localeCompare(String(a.data.effectiveDate)))[0];
}

/** Hai hợp đồng trùng khoảng ngày (ngày kết thúc trống là không thời hạn). */
export function overlaps(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const end = (x: Record<string, unknown>) => (x.endDate ? String(x.endDate) : '9999-12-31');
  return String(a.startDate) <= end(b) && String(b.startDate) <= end(a);
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
    @InjectRepository(ProfileFile) private readonly fileRepo: Repository<ProfileFile>,
    private readonly fileService: ProfileFileService,
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
    return this.withFiles(list.map((r) => this.view(r, true)));
  }

  private async withFiles(views: RequestView[]): Promise<RequestView[]> {
    const ids = views.flatMap((v) => v.fileIds);
    if (!ids.length) return views;
    const byId = new Map((await this.fileRepo.findBy({ id: In(ids) })).map((f) => [f.id, fileView(f)]));
    return views.map((v) => ({ ...v, files: v.fileIds.map((id) => byId.get(id)).filter((x): x is FileView => !!x) }));
  }

  /** Mục nhiều dòng hoặc một dòng (liên hệ khẩn cấp, thân nhân, chuyên môn, tài khoản ngân hàng). */
  async readSection(employeeId: string, code: string, viewer: AuthUser, reveal: boolean, meta: RequestMeta = {}) {
    const e = await this.employees.findOneBy({ id: employeeId });
    if (!e) throw new NotFoundException('Không tìm thấy nhân viên');
    const relation = await resolveRelation(this.employees, viewer, e);
    const def = findSection(code);
    const schema = SECTION_SCHEMAS[code];
    if (!def || !def.available || !schema || schema.kind === 'main' || !canSeeLevel(relation, def.level)) {
      throw new NotFoundException('Không tìm thấy mục hồ sơ');
    }
    const sensitiveKeys = schema.fields.filter((f) => f.sensitive).map((f) => f.key);
    if (reveal && !sensitiveKeys.length) throw new BadRequestException('Mục này không có giá trị nhạy cảm');
    // NC (tài khoản ngân hàng) và trường nhạy cảm của dòng: chỉ chủ hồ sơ và HR giải mã.
    if (reveal && relation !== 'OWNER' && relation !== 'HR') throw new ForbiddenException('Bạn không được xem giá trị này');

    if (schema.kind === 'files') {
      if (relation !== 'OWNER' && relation !== 'HR') throw new NotFoundException('Không tìm thấy mục hồ sơ');
      return {
        section: code,
        kind: schema.kind,
        maxRows: schema.maxRows,
        notice: schema.notice ?? null,
        fields: [],
        canPropose: relation === 'OWNER',
        canEdit: relation === 'HR',
        rows: [],
        files: await this.fileService.list(employeeId, code, viewer),
        requests: await this.openRequests(employeeId, code),
      };
    }
    const rows = await this.rowsOf(employeeId, code, schema, reveal);
    // File gắn vào từng dòng (bằng cấp, giấy tờ người phụ thuộc): mức CN, quản lý trực tiếp không thấy.
    if (relation === 'OWNER' || relation === 'HR') {
      const ids = rows.map((r) => r.id).filter((x): x is string => !!x);
      const files = ids.length ? await this.fileRepo.find({ where: { employeeId, itemId: In(ids), status: 'READY' }, order: { createdAt: 'DESC' } }) : [];
      for (const r of rows) r.files = files.filter((f) => f.itemId === r.id).map(fileView);
    }
    const extra = await this.extras(employeeId, code, rows, reveal);
    const currentShown = (extra as { current?: MaskedValue }).current?.hasValue;
    if (reveal && (currentShown || rows.some((r) => Object.values(r.sensitive).some((v) => v.hasValue)))) {
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
      canPropose: relation === 'OWNER' && schema.proposeBy === 'NV',
      canEdit: relation === 'HR',
      rows,
      requests: own ? await this.openRequests(employeeId, code) : [],
      ...extra,
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
    if (!schema || schema.proposeBy === 'HR') throw new ForbiddenException('Mục này do HR quản lý, nhân viên không gửi yêu cầu được');
    // Trường chỉ HR nhập trong mục có cả trường NV (số thẻ BHYT).
    const hrKeys = schema.fields.filter((f) => f.hrOnly).map((f) => f.key);
    if (Object.keys(input.proposed ?? {}).some((k) => hrKeys.includes(k))) throw new ForbiddenException('Trường này do HR nhập');
    // Bảo hiểm y tế: nơi khám chữa bệnh ban đầu đổi tối đa một lần mỗi quý.
    if (input.section === 'health-insurance' && (await this.changedThisQuarter(employeeId, 'health-insurance'))) {
      throw new ConflictException('Nơi khám chữa bệnh ban đầu chỉ đổi được một lần mỗi quý');
    }

    // A7, AC-1.9.12: gửi lại cùng Idempotency-Key thì trả yêu cầu đã tạo.
    const again = await this.requests.findOneBy({ submittedBy: viewer.employeeId, idempotencyKey });
    if (again) return this.view(again, true);

    const action = input.action;
    const fileIds = [...new Set(input.fileIds ?? [])];
    if (schema.kind === 'files') {
      if (action === 'UPDATE' || (input.section === 'avatar' && action !== 'CREATE')) throw new BadRequestException('Mục này chỉ cho phép thêm hoặc xóa file');
      if (!fileIds.length) throw new BadRequestException('Chưa chọn file');
    } else if (schema.kind !== 'rows' && action !== 'UPDATE') throw new BadRequestException('Mục này chỉ cho phép sửa');
    if (schema.kind === 'rows' && action !== 'CREATE' && !input.itemId) throw new BadRequestException('Thiếu itemId của dòng cần sửa, xóa');
    if (schema.kind === 'rows' && action === 'CREATE' && input.itemId) throw new BadRequestException('Thêm dòng mới không kèm itemId');

    let data: Record<string, unknown> = {};
    let sensitive: Record<string, string> = {};
    if (action !== 'DELETE' && schema.kind !== 'files') {
      const v = validateSection(input.section, input.proposed ?? {}, today(), schema.kind === 'main');
      if (Object.keys(v.errors).length) throw new BadRequestException({ message: Object.values(v.errors), fields: v.errors });
      data = v.data;
      sensitive = v.sensitive;
      if (!Object.keys(data).length && !Object.keys(sensitive).length && !fileIds.length) throw new BadRequestException('Không có thay đổi nào');
    }
    if (schema.kind === 'main' && fileIds.length) throw new BadRequestException('Mục này không nhận file');
    // File đính kèm: đã tải lên xong, của chính mình, đúng mục. Yêu cầu xóa file: file đang dùng, không phải HR tải (E14).
    const attached =
      schema.kind === 'files' && action === 'DELETE'
        ? await this.fileService.assertDeletable(employeeId, input.section, fileIds)
        : await this.fileService.assertAttachable(employeeId, input.section, fileIds, viewer);

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
      } else if (schema.kind === 'files') {
        baseVersion = 0;
        if (action === 'CREATE' && input.section !== 'avatar') {
          const ready = await m.getRepository(ProfileFile).countBy({ employeeId, section: input.section, status: 'READY' });
          const pending = await m.getRepository(ProfileFile).count({ where: { employeeId, section: input.section, status: 'PENDING_REVIEW', changeRequestId: Not(IsNull()) } });
          if (ready + pending + attached.length > schema.maxRows) {
            throw new ConflictException(`Mục này tối đa ${schema.maxRows} file (tính cả file đang chờ duyệt)`);
          }
        }
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
      if (input.section === 'avatar') {
        await reqRepo.update({ employeeId, section: 'avatar', status: 'PENDING' }, { status: 'CANCELLED' });
      } else if (schema.kind !== 'files' && (schema.kind !== 'rows' || action !== 'CREATE')) {
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
          fileIds,
        }),
      );
      if (attached.length && action !== 'DELETE') {
        await m.getRepository(ProfileFile).update({ id: In(attached.map((f) => f.id)) }, { changeRequestId: saved.id });
      }
      const fields = [...Object.keys(data), ...Object.keys(sensitive)];
      await this.audit.record(
        {
          actorId: viewer.employeeId,
          action: 'PROFILE_CHANGE_SUBMIT',
          entityType: 'employee',
          entityId: employeeId,
          changedFields: { section: input.section, requestId: saved.id, action, itemId, fields, fileIds },
          ...meta,
        },
        m,
      );
      await this.outbox(m, 'ProfileChangeSubmitted', saved);
      return (await this.withFiles([this.view(saved, true)]))[0]!;
    });
  }

  async cancel(employeeId: string, requestId: string, viewer: AuthUser, meta: RequestMeta = {}) {
    await this.requests.manager.transaction(async (m) => {
      const r = await m.getRepository(ProfileChangeRequest).findOne({ where: { id: requestId, employeeId }, lock: { mode: 'pessimistic_write' } });
      if (!r || r.submittedBy !== viewer.employeeId) throw new NotFoundException('Không tìm thấy yêu cầu');
      if (r.status !== 'PENDING') throw new ConflictException('Yêu cầu không còn chờ xác nhận');
      await m.getRepository(ProfileChangeRequest).update(r.id, { status: 'CANCELLED' });
      await this.releaseFiles(m, r);
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
    const [withFiles] = await this.withFiles([view]);
    return {
      ...withFiles!,
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
      const itemId = await this.applyChange(m, {
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
      await this.applyFiles(m, r, itemId);
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
      await this.releaseFiles(m, r);
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
      // E18, AC-1.12.2: hợp đồng mới không trùng khoảng ngày với hợp đồng khác của cùng người (khóa theo nhân viên).
      if (section === 'contracts' && action !== 'DELETE') {
        await m.query('SELECT id FROM employee.employee WHERE id = $1 FOR UPDATE', [employeeId]);
        const others = await m.getRepository(ProfileItem).findBy({ employeeId, section, deletedAt: IsNull() });
        const clash = others.find((o) => o.id !== itemId && overlaps(o.data, data));
        if (clash) throw new ConflictException('Hợp đồng trùng khoảng ngày với hợp đồng khác của nhân viên này');
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
      // AC-1.12.3: "Lương mục tiêu" là mức đang hiệu lực; giữ employee_sensitive.salary_enc khớp để form HR và báo cáo cũ dùng.
      if (section === 'salary') await this.syncSalary(m, employeeId);
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
    if (schema.kind === 'files') return null;
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
    const relation = await resolveRelation(this.employees, viewer, e);
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
      cancelReason: r.cancelReason ?? null,
      fileIds: r.fileIds ?? [],
      ...(withReason ? { rejectReason: r.rejectReason } : {}),
    };
  }

  private fieldNames(r: ProfileChangeRequest, sensitive?: Record<string, string>): string[] {
    const s = sensitive ?? (r.proposedSensitive ? JSON.parse(this.crypto.decrypt(r.proposedSensitive) ?? '{}') : {});
    return [...Object.keys(r.proposed), ...Object.keys(s)];
  }

  /**
   * Mục tự tính (FR-1.13), mức QL: quá trình công tác (audit nhóm trường tổ chức + dòng HR nhập trước khi có hệ thống), các mốc
   * trong công ty (thâm niên), ngày nghỉ dài (đơn nghỉ ≥ 14 ngày làm việc đã duyệt hoặc hoàn tất, khoảng ON_LEAVE).
   */
  async computed(employeeId: string, code: string, viewer: AuthUser) {
    const e = await this.employees.findOneBy({ id: employeeId });
    if (!e) throw new NotFoundException('Không tìm thấy nhân viên');
    const relation = await resolveRelation(this.employees, viewer, e);
    const def = findSection(code);
    if (!def || !def.available || !canSeeLevel(relation, def.level)) throw new NotFoundException('Không tìm thấy mục hồ sơ');
    const base = { section: code, kind: 'computed' as const, canEdit: relation === 'HR' };

    if (code === 'milestones') return { ...base, ...seniority(e.hireDate, today()) };

    const audits = (await this.audit.history({ entityType: 'employee', entityId: employeeId, actions: ['UPDATE'], page: 1, size: 1000 })).items;
    const changesOf = (keys: string[]) =>
      audits
        .map((a) => ({ at: a.at.toISOString(), cf: (a.changedFields ?? {}) as Record<string, { from: unknown; to: unknown }> }))
        .filter((a) => keys.some((k) => a.cf[k] && typeof a.cf[k] === 'object'));

    if (code === 'long-leaves') {
      // Đọc thẳng bảng đơn nghỉ: module nghỉ phép phụ thuộc module hồ sơ, nên không gọi ngược service của nó.
      const leaves: { start_date: string; end_date: string; days: string; name: string }[] = await this.items.query(
        `SELECT to_char(r.start_date, 'YYYY-MM-DD') AS start_date, to_char(r.end_date, 'YYYY-MM-DD') AS end_date, r.days, t.name
           FROM leave.leave_request r JOIN leave.leave_type t ON t.id = r.leave_type_id
          WHERE r.employee_id = $1 AND r.status IN ('APPROVED', 'COMPLETED') AND r.days >= 14
          ORDER BY r.start_date DESC`,
        [employeeId],
      );
      const statusChanges = changesOf(['status']).map((a) => ({ at: a.at, from: a.cf.status!.from, to: a.cf.status!.to }));
      const rows = [
        ...leaves.map((l) => ({ type: l.name, from: l.start_date, to: l.end_date, days: Number(l.days), source: 'LEAVE' as const })),
        ...onLeavePeriods(statusChanges).map((p) => ({ type: 'Tạm nghỉ (ON_LEAVE)', from: p.from, to: p.to, days: null, source: 'STATUS' as const })),
      ].sort((a, b) => b.from.localeCompare(a.from));
      return { ...base, rows };
    }

    // career-history (UC2 FR-2.8): nguồn chính là bảng quá trình công tác; audit chỉ còn để tra cứu.
    const lookups = await this.org.lookups();
    const rows: { department_id: string; position_id: string; manager_id: string | null; from: string; to: string | null; reason: string; status: string; manager_name: string | null }[] =
      await this.items.query(
        `SELECT a.department_id, a.position_id, a.manager_id, to_char(a.effective_from, 'YYYY-MM-DD') AS "from",
                to_char(a.effective_to, 'YYYY-MM-DD') AS "to", a.reason, a.status, m.full_name AS manager_name
           FROM employee.employment_assignment a LEFT JOIN employee.employee m ON m.id = a.manager_id
          WHERE a.employee_id = $1 AND a.status IN ('ACTIVE', 'CLOSED', 'SCHEDULED')
            AND (a.effective_to IS NULL OR a.effective_to >= a.effective_from)
          ORDER BY a.effective_from DESC, a.created_at DESC`,
        [employeeId],
      );
    const manual = await this.items.find({ where: { employeeId, section: 'career-history', deletedAt: IsNull() } });
    const periods = [
      ...rows.map((p) => ({
        from: p.from,
        to: p.to,
        department: lookups.department.get(p.department_id)?.name ?? null,
        unitType: lookups.department.get(p.department_id)?.unitType ?? null,
        position: lookups.position.get(p.position_id)?.title ?? null,
        manager: p.manager_name,
        reason: CAREER_REASON[p.reason] ?? p.reason,
        upcoming: p.status === 'SCHEDULED',
        source: 'AUTO' as const,
      })),
      ...manual.map((m) => ({
        from: String(m.data.from),
        to: (m.data.to as string | undefined) ?? null,
        department: (m.data.department as string) ?? null,
        position: (m.data.position as string) ?? null,
        manager: (m.data.manager as string | undefined) ?? null,
        reason: String(m.data.reason ?? ''),
        unitType: null,
        upcoming: false,
        source: 'HR' as const,
      })),
    ].sort((a, b) => b.from.localeCompare(a.from));
    return { ...base, periods };
  }

  /** Thông tin tính thêm của mục: mức đang hiệu lực (lương, lương đóng BHXH), số người phụ thuộc (thuế TNCN). */
  private async extras(employeeId: string, code: string, rows: RowView[], reveal: boolean) {
    if (code === 'salary' || code === 'insurance-salary') {
      const cur = currentRow(rows);
      let current: MaskedValue = cur ? cur.sensitive.amount ?? { hasValue: false, value: null } : { hasValue: false, value: null };
      if (!cur && code === 'salary') {
        // Dữ liệu có từ trước khi có lịch sử lương: một mức trong employee_sensitive.
        const enc = (await this.items.manager.getRepository(EmployeeSensitive).findOneBy({ employeeId }))?.salaryEnc ?? null;
        current = { hasValue: !!enc, value: reveal ? this.crypto.decrypt(enc) : null };
      }
      // `salary` giữ tên trường cũ cho hàng "Lương mục tiêu" ở đầu trang.
      return { current, salary: current, currentEffectiveDate: (cur?.data.effectiveDate as string | undefined) ?? null };
    }
    if (code === 'tax') return { dependents: await this.dependentCount(employeeId) };
    return {};
  }

  /** AC-1.9.11: số người phụ thuộc đang trong thời gian giảm trừ (tháng hiện tại nằm trong [từ tháng, đến tháng]). */
  async dependentCount(employeeId: string): Promise<number> {
    const month = today().slice(0, 7);
    const list = await this.items.findBy({ employeeId, section: 'relatives', deletedAt: IsNull() });
    return list.filter(
      (r) => r.data.isDependent === true && String(r.data.dependentFrom ?? '9999') <= month && (!r.data.dependentTo || String(r.data.dependentTo) >= month),
    ).length;
  }

  /** Loại hợp đồng đang hiệu lực hôm nay (hàng "Diện đối tượng", AC-1.12.1); null nếu chưa có. */
  async activeContractType(employeeId: string): Promise<string | null> {
    const d = today();
    const list = await this.items.findBy({ employeeId, section: 'contracts', deletedAt: IsNull() });
    const active = list
      .filter((c) => String(c.data.startDate) <= d && (!c.data.endDate || String(c.data.endDate) >= d))
      .sort((a, b) => String(b.data.startDate).localeCompare(String(a.data.startDate)))[0];
    return active ? (CONTRACT_LABEL[String(active.data.type)] ?? String(active.data.type)) : null;
  }

  /** AC-1.12.5: hợp đồng còn tối đa `days` ngày nữa hết hạn (HR). */
  async expiringContracts(days: number) {
    const rows: { item_id: string; employee_id: string; full_name: string; employee_code: string; type: string; number: string; end_date: string }[] =
      await this.items.query(
        `SELECT i.id AS item_id, e.id AS employee_id, e.full_name, e.employee_code,
                i.data ->> 'type' AS type, i.data ->> 'number' AS number, i.data ->> 'endDate' AS end_date
           FROM employee.profile_item i JOIN employee.employee e ON e.id = i.employee_id
          WHERE i.section = 'contracts' AND i.deleted_at IS NULL AND e.status <> 'TERMINATED'
            AND (i.data ->> 'endDate') BETWEEN to_char(current_date, 'YYYY-MM-DD') AND to_char(current_date + $1::int, 'YYYY-MM-DD')
          ORDER BY i.data ->> 'endDate'`,
        [days],
      );
    return rows.map((r) => ({
      itemId: r.item_id,
      employeeId: r.employee_id,
      fullName: r.full_name,
      employeeCode: r.employee_code,
      type: CONTRACT_LABEL[r.type] ?? r.type,
      number: r.number,
      endDate: r.end_date,
    }));
  }

  private async changedThisQuarter(employeeId: string, section: string): Promise<boolean> {
    const now = new Date();
    const qStart = new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1));
    return this.requests.exists({ where: { employeeId, section, status: 'APPROVED', reviewedAt: MoreThanOrEqual(qStart) } });
  }

  private async syncSalary(m: EntityManager, employeeId: string) {
    const list = await m.getRepository(ProfileItem).findBy({ employeeId, section: 'salary', deletedAt: IsNull() });
    const cur = list
      .filter((r) => String(r.data.effectiveDate) <= today())
      .sort((a, b) => String(b.data.effectiveDate).localeCompare(String(a.data.effectiveDate)))[0];
    if (!cur?.sensitiveData) return;
    const amount = (JSON.parse(this.crypto.decrypt(cur.sensitiveData) ?? '{}') as Record<string, string>).amount;
    if (!amount) return;
    const repo = m.getRepository(EmployeeSensitive);
    const s = (await repo.findOneBy({ employeeId })) ?? repo.create({ employeeId });
    s.salaryEnc = this.crypto.encrypt(amount);
    await repo.save(s);
  }

  /** Duyệt: file kèm chuyển READY (gắn vào dòng nếu có); yêu cầu xóa file thì file DELETED; ảnh đại diện mới thay ảnh cũ. */
  private async applyFiles(m: EntityManager, r: ProfileChangeRequest, itemId: string | null) {
    if (!r.fileIds.length) return;
    const repo = m.getRepository(ProfileFile);
    const list = await repo.findBy({ id: In(r.fileIds), employeeId: r.employeeId });
    if (SECTION_SCHEMAS[r.section]?.kind === 'files' && r.action === 'DELETE') {
      if (list.some((f) => f.status !== 'READY')) throw new ConflictException('File đã thay đổi sau khi gửi yêu cầu');
      await this.fileService.markDeleted(list);
      return;
    }
    if (list.some((f) => f.status !== 'PENDING_REVIEW')) throw new ConflictException('File đính kèm không còn hợp lệ');
    await repo.update({ id: In(list.map((f) => f.id)) }, { status: 'READY', ...(itemId ? { itemId } : {}) });
    if (r.section === 'avatar') {
      const e = await m.getRepository(Employee).findOneByOrFail({ id: r.employeeId });
      const old = e.avatarFileId ? await repo.findBy({ id: e.avatarFileId }) : [];
      await m.getRepository(Employee).update(e.id, { avatarFileId: list[0]!.id });
      if (old.length) await this.fileService.markDeleted(old);
    }
  }

  /** Từ chối, hủy: file kèm (chưa dùng) chuyển REJECTED, lifecycle xóa sau 30 ngày. */
  private async releaseFiles(m: EntityManager, r: ProfileChangeRequest) {
    if (!r.fileIds.length || (SECTION_SCHEMAS[r.section]?.kind === 'files' && r.action === 'DELETE')) return;
    await m.getRepository(ProfileFile).update({ id: In(r.fileIds), status: 'PENDING_REVIEW' }, { status: 'REJECTED' });
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

/** Lý do trong quá trình công tác (AC-2.8.1). */
const CAREER_REASON: Record<string, string> = {
  HIRE: 'Tuyển mới',
  TRANSFER: 'Điều chuyển',
  PROMOTION: 'Thăng chức',
  MANAGER_CHANGE: 'Đổi quản lý',
  CORRECTION: 'Điều chỉnh',
};
