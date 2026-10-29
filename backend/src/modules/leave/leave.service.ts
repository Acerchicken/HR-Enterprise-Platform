import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, EntityManager, In, LessThanOrEqual, MoreThanOrEqual, QueryFailedError, Repository } from 'typeorm';
import { Page } from '../../common/pagination';
import { AuditService } from '../audit/audit.service';
import { EmployeeService, RequestMeta } from '../employee/employee.service';
import { AuthUser, hasRole } from '../identity/roles';
import { LeaveBalance } from './leave-balance.entity';
import { Holiday } from './leave-holiday.entity';
import { LeaveRequest, LeaveRequestHistory } from './leave-request.entity';
import { availableDays, isValidDate, leaveDays, overlaps } from './leave-rules';
import { ActorRelation, BalanceEffect, LeaveAction, LeaveStatus, submitEffect, transition } from './leave-state-machine';
import { LeaveType } from './leave-type.entity';
import { CreateLeaveRequestDto, LeaveDecisionDto, LeaveRequestQuery, LeaveRequestView } from './leave.dto';

const ACTIVE: LeaveStatus[] = ['SUBMITTED', 'APPROVED'];

const AUDIT_ACTION: Record<LeaveAction, string> = {
  approve: 'LEAVE_APPROVE',
  reject: 'LEAVE_REJECT',
  cancel: 'LEAVE_CANCEL',
  complete: 'LEAVE_COMPLETE',
};

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(LeaveType) private readonly types: Repository<LeaveType>,
    @InjectRepository(LeaveBalance) private readonly balances: Repository<LeaveBalance>,
    @InjectRepository(LeaveRequest) private readonly requests: Repository<LeaveRequest>,
    @InjectRepository(LeaveRequestHistory) private readonly history: Repository<LeaveRequestHistory>,
    @InjectRepository(Holiday) private readonly holidays: Repository<Holiday>,
    private readonly employees: EmployeeService,
    private readonly audit: AuditService,
  ) {}

  listTypes() {
    return this.types.find({ order: { code: 'ASC' } });
  }

  listHolidays(year = new Date().getFullYear()) {
    return this.holidays.find({ where: { date: Between(`${year}-01-01`, `${year}-12-31`) }, order: { date: 'ASC' } });
  }

  async balancesOf(employeeId: string, year = new Date().getFullYear()) {
    const [types, rows] = await Promise.all([
      this.types.find(),
      this.balances.find({ where: { employeeId, year } }),
    ]);
    const typeById = new Map(types.map((t) => [t.id, t]));
    return rows.map((b) => {
      const entitled = Number(b.entitled);
      const used = Number(b.used);
      const pending = Number(b.pending);
      return {
        leaveType: typeById.get(b.leaveTypeId)?.code,
        leaveTypeName: typeById.get(b.leaveTypeId)?.name,
        year: b.year,
        entitled,
        used,
        pending,
        available: availableDays({ entitled, used, pending }),
      };
    });
  }

  // ---------- Tạo đơn (BR-01 → BR-04) ----------

  async create(dto: CreateLeaveRequestDto, idempotencyKey: string, actor: AuthUser, meta: RequestMeta = {}): Promise<LeaveRequestView> {
    const employeeId = this.requireEmployee(actor);
    const period = { startDate: dto.startDate, endDate: dto.endDate, halfDay: dto.halfDay ?? null };

    // Gửi lại cùng Idempotency-Key (retry, bấm 2 lần) → trả đơn đã tạo, không tạo đơn mới.
    const existing = await this.requests.findOneBy({ employeeId, idempotencyKey });
    if (existing) return this.replay(existing, dto);

    const type = await this.types.findOneBy({ code: dto.leaveType });
    if (!type) throw new BadRequestException('Loại phép không tồn tại');
    if (!isValidDate(period.startDate) || !isValidDate(period.endDate)) throw new BadRequestException('Ngày không hợp lệ');
    if (period.endDate < period.startDate) throw new BadRequestException('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu');
    if (period.startDate.slice(0, 4) !== period.endDate.slice(0, 4)) {
      throw new BadRequestException('Đơn phải nằm trong cùng một năm, hãy tách thành hai đơn');
    }
    if (period.halfDay && period.startDate !== period.endDate) {
      throw new BadRequestException('Nghỉ nửa ngày chỉ áp dụng cho một ngày');
    }

    try {
      const id = await this.requests.manager.transaction(async (m) => {
        // Khóa theo nhân viên để kiểm tra trùng lịch và số dư không bị hai request song song vượt qua cùng lúc.
        await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [employeeId]);
        const dup = await m.findOneBy(LeaveRequest, { employeeId, idempotencyKey });
        if (dup) return dup.id;

        const days = leaveDays(period, await this.holidaySet(m, period.startDate, period.endDate));
        if (days === 0) throw new BadRequestException('Khoảng nghỉ không có ngày làm việc nào (cuối tuần hoặc ngày lễ)');

        const active = await m.find(LeaveRequest, {
          where: {
            employeeId,
            status: In(ACTIVE),
            startDate: LessThanOrEqual(period.endDate),
            endDate: MoreThanOrEqual(period.startDate),
          },
        });
        const clash = active.find((r) => overlaps(period, r));
        if (clash) {
          throw new ConflictException(`Trùng lịch với đơn ${clash.startDate} – ${clash.endDate} đang ${clash.status}`);
        }

        const year = Number(period.startDate.slice(0, 4));
        const balance = await this.lockBalance(m, employeeId, type, year);
        const available = availableDays({
          entitled: Number(balance.entitled),
          used: Number(balance.used),
          pending: Number(balance.pending),
        });
        if (days > available) throw new BadRequestException(`Không đủ số dư: cần ${days} ngày, còn ${available} ngày`);
        await this.applyBalance(m, employeeId, type.id, year, submitEffect(days));

        const saved = await m.save(
          m.create(LeaveRequest, {
            employeeId,
            leaveTypeId: type.id,
            startDate: period.startDate,
            endDate: period.endDate,
            halfDay: period.halfDay,
            days: String(days),
            reason: dto.reason ?? null,
            status: 'SUBMITTED',
            approverId: null,
            idempotencyKey,
          }),
        );
        await m.insert(LeaveRequestHistory, { requestId: saved.id, fromStatus: null, toStatus: 'SUBMITTED', actorId: employeeId, comment: null });
        await this.audit.record(
          {
            actorId: employeeId,
            action: 'LEAVE_SUBMIT',
            entityType: 'leave_request',
            entityId: saved.id,
            changedFields: { leaveType: type.code, ...period, days },
            ...meta,
          },
          m,
        );
        return saved.id;
      });
      return this.get(id, actor);
    } catch (e) {
      // Hai request cùng key đến gần như đồng thời: request sau vấp UNIQUE (employee_id, idempotency_key).
      if (e instanceof QueryFailedError && (e as any).code === '23505') {
        const again = await this.requests.findOneBy({ employeeId, idempotencyKey });
        if (again) return this.replay(again, dto);
      }
      throw e;
    }
  }

  // ---------- Duyệt, từ chối, hủy, HR hoàn tất (BR-05 → BR-11) ----------

  async act(id: string, action: LeaveAction, dto: LeaveDecisionDto, actor: AuthUser, meta: RequestMeta = {}): Promise<LeaveRequestView> {
    await this.requests.manager.transaction(async (m) => {
      const r = await m.findOne(LeaveRequest, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!r) throw new NotFoundException('Không tìm thấy đơn nghỉ phép');

      const days = Number(r.days);
      const result = transition(r.status, action, await this.relation(action, r, actor), days);
      if (result.kind === 'forbidden') throw new ForbiddenException(result.reason);
      if (result.kind === 'conflict') throw new ConflictException(result.reason);
      if (result.kind === 'unchanged') return; // BR-11: gửi lặp cùng quyết định không đổi gì

      if (dto.version !== r.version) throw new ConflictException('Đơn đã được người khác cập nhật, hãy tải lại');

      const year = Number(r.startDate.slice(0, 4));
      await this.applyBalance(m, r.employeeId, r.leaveTypeId, year, result.balanceEffect);

      const from = r.status;
      r.status = result.to;
      if (action === 'approve' || action === 'reject') r.approverId = actor.employeeId;
      await m.save(r);
      await m.insert(LeaveRequestHistory, {
        requestId: r.id,
        fromStatus: from,
        toStatus: result.to,
        actorId: actor.employeeId!,
        comment: dto.comment ?? null,
      });
      await this.audit.record(
        {
          actorId: actor.employeeId,
          action: AUDIT_ACTION[action],
          entityType: 'leave_request',
          entityId: r.id,
          changedFields: { status: { from, to: result.to }, days, ...(dto.comment ? { comment: dto.comment } : {}) },
          ...meta,
        },
        m,
      );
    });
    return this.get(id, actor);
  }

  // ---------- Xem đơn ----------

  async get(id: string, actor: AuthUser): Promise<LeaveRequestView> {
    const r = await this.requests.findOneBy({ id });
    if (!r) throw new NotFoundException('Không tìm thấy đơn nghỉ phép');
    const isOwner = actor.employeeId === r.employeeId;
    const isManager = !!actor.employeeId && actor.employeeId === (await this.employees.managerIdOf(r.employeeId));
    if (!isOwner && !isManager && !hasRole(actor, 'HR')) throw new ForbiddenException('Không có quyền xem đơn này');
    return this.detail(r);
  }

  mine(actor: AuthUser, q: LeaveRequestQuery): Promise<Page<LeaveRequestView>> {
    return this.page([this.requireEmployee(actor)], q);
  }

  /** Đơn chờ quản lý trực tiếp duyệt (BR-05). */
  async pendingApproval(actor: AuthUser, q: LeaveRequestQuery): Promise<Page<LeaveRequestView>> {
    const reports = await this.employees.directReportIds(this.requireEmployee(actor));
    return this.page(reports, { ...q, status: 'SUBMITTED' } as LeaveRequestQuery);
  }

  /** HR xem toàn bộ đơn, mặc định là đơn đã duyệt chờ hoàn tất (BR-10). */
  all(q: LeaveRequestQuery): Promise<Page<LeaveRequestView>> {
    return this.page(null, { ...q, status: q.status ?? 'APPROVED' } as LeaveRequestQuery);
  }

  // ---------- Nội bộ ----------

  private requireEmployee(actor: AuthUser): string {
    if (!actor.employeeId) throw new NotFoundException('Tài khoản chưa gắn với nhân viên');
    return actor.employeeId;
  }

  private async replay(existing: LeaveRequest, dto: CreateLeaveRequestDto): Promise<LeaveRequestView> {
    const type = await this.types.findOneBy({ code: dto.leaveType });
    const same =
      existing.leaveTypeId === type?.id &&
      existing.startDate === dto.startDate &&
      existing.endDate === dto.endDate &&
      existing.halfDay === (dto.halfDay ?? null);
    if (!same) throw new ConflictException('Idempotency-Key đã được dùng cho một đơn khác');
    return this.detail(existing);
  }

  /** Đơn kèm lịch sử chuyển trạng thái (BR-11). Gọi sau khi đã kiểm tra quyền xem. */
  private async detail(r: LeaveRequest): Promise<LeaveRequestView> {
    const history = await this.history.find({ where: { requestId: r.id }, order: { at: 'ASC', id: 'ASC' } });
    const names = await this.employees.namesOf([r.employeeId, ...history.map((h) => h.actorId)]);
    const [view] = await this.toViews([r], names);
    view.history = history.map((h) => ({
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      actorId: h.actorId,
      actorName: names.get(h.actorId) ?? null,
      comment: h.comment,
      at: h.at,
    }));
    return view;
  }

  /** Quan hệ của người thao tác với đơn, theo đúng thao tác đang làm. */
  private async relation(action: LeaveAction, r: LeaveRequest, actor: AuthUser): Promise<ActorRelation> {
    if (!actor.employeeId) return 'OTHER';
    if (action === 'cancel') return actor.employeeId === r.employeeId ? 'OWNER' : 'OTHER';
    if (action === 'complete') return hasRole(actor, 'HR') ? 'HR' : 'OTHER';
    // Duyệt/từ chối: phải là quản lý trực tiếp tại thời điểm xử lý (BR-05).
    return actor.employeeId === (await this.employees.managerIdOf(r.employeeId)) ? 'DIRECT_MANAGER' : 'OTHER';
  }

  private async holidaySet(m: EntityManager, from: string, to: string): Promise<Set<string>> {
    const rows = await m.find(Holiday, { where: { date: Between(from, to) } });
    return new Set(rows.map((h) => h.date));
  }

  /** Khóa dòng số dư; loại phép chưa có số dư (nghỉ cưới, không lương…) được cấp theo max_days_per_year. */
  private async lockBalance(m: EntityManager, employeeId: string, type: LeaveType, year: number): Promise<LeaveBalance> {
    const where = { employeeId, leaveTypeId: type.id, year };
    let b = await m.findOne(LeaveBalance, { where, lock: { mode: 'pessimistic_write' } });
    if (!b) {
      await m.insert(LeaveBalance, { ...where, entitled: type.maxDaysPerYear, used: '0', pending: '0' });
      b = await m.findOneOrFail(LeaveBalance, { where, lock: { mode: 'pessimistic_write' } });
    }
    return b;
  }

  private async applyBalance(m: EntityManager, employeeId: string, leaveTypeId: string, year: number, e: BalanceEffect) {
    if (e.pending === 0 && e.used === 0) return;
    await m.query(
      `UPDATE leave.leave_balance SET pending = pending + $4, used = used + $5
       WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3`,
      [employeeId, leaveTypeId, year, e.pending, e.used],
    );
  }

  private async page(employeeIds: string[] | null, q: LeaveRequestQuery): Promise<Page<LeaveRequestView>> {
    if (employeeIds && employeeIds.length === 0) return { items: [], page: q.page, size: q.size, total: 0 };
    const [rows, total] = await this.requests.findAndCount({
      where: {
        ...(employeeIds ? { employeeId: In(employeeIds) } : {}),
        ...(q.status ? { status: q.status } : {}),
      },
      order: { startDate: 'DESC', createdAt: 'DESC' },
      skip: (q.page - 1) * q.size,
      take: q.size,
    });
    const names = await this.employees.namesOf(rows.map((r) => r.employeeId));
    return { items: await this.toViews(rows, names), page: q.page, size: q.size, total };
  }

  private async toViews(rows: LeaveRequest[], names: Map<string, string>): Promise<LeaveRequestView[]> {
    const types = new Map((await this.types.find()).map((t) => [t.id, t.code]));
    return rows.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: names.get(r.employeeId) ?? null,
      leaveType: types.get(r.leaveTypeId) ?? null,
      startDate: r.startDate,
      endDate: r.endDate,
      halfDay: r.halfDay,
      days: Number(r.days),
      reason: r.reason,
      status: r.status,
      approverId: r.approverId,
      version: r.version,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }
}
