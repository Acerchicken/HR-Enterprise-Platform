import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, In, QueryFailedError, Repository, SelectQueryBuilder } from 'typeorm';
import { Page } from '../../common/pagination';
import { AuditService } from '../audit/audit.service';
import { EmployeeService, RequestMeta } from '../employee/employee.service';
import { vnToday } from '../employee/transfer-rules';
import { AuthUser, hasRole } from '../identity/roles';
import { allowed, canCreateFor, canSeeReason, canView, isApprover, PRIVATE_REASON_TYPES, relation, Relation, RequestFacts } from './leave-access';
import { LeaveBalanceService } from './leave-balance.service';
import { LeaveCalendar } from './leave-calendar';
import { LeaveAllocation, LeaveRequest, LeaveRequestHistory } from './leave-request.entity';
import {
  allocateByYear,
  completableFrom,
  eventDateInRange,
  exceedsEventLimit,
  isValidDate,
  leaveDays,
  needsHrApproval,
  overlaps,
  reminderDueAt,
} from './leave-rules';
import { ACTIVE_STATUSES, LeaveAction, LeaveStatus, transition } from './leave-state-machine';
import { LeaveType } from './leave-type.entity';
import { CancelRequestDto, CreateLeaveRequestDto, LeaveDecisionDto, LeaveRequestQuery, LeaveRequestView, RecalculateDto } from './leave.dto';
import { CancelReason, LeaveEventPayload, LeaveEventType } from './outbox/leave-events';
import { OutboxEvent } from './outbox/outbox.entity';

const AUDIT_ACTION: Record<LeaveAction, string> = {
  approve: 'LEAVE_APPROVE',
  reject: 'LEAVE_REJECT',
  hrApprove: 'LEAVE_HR_APPROVE',
  hrReject: 'LEAVE_HR_REJECT',
  cancel: 'LEAVE_CANCEL',
  cancelRequest: 'LEAVE_CANCEL_REQUEST',
  cancelRequestApprove: 'LEAVE_CANCEL_APPROVED',
  cancelRequestReject: 'LEAVE_CANCEL_REQUEST_REJECT',
  complete: 'LEAVE_COMPLETE',
  systemCancel: 'LEAVE_SYSTEM_CANCEL',
};

/** Thao tác bắt buộc có ghi chú (E12, AC-0.6.3). */
const NEEDS_COMMENT: LeaveAction[] = ['reject', 'hrReject', 'cancelRequestReject'];

const fieldError = (field: string, message: string) => new BadRequestException({ message, fields: [field] });

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(LeaveType) private readonly types: Repository<LeaveType>,
    @InjectRepository(LeaveRequest) private readonly requests: Repository<LeaveRequest>,
    @InjectRepository(LeaveRequestHistory) private readonly history: Repository<LeaveRequestHistory>,
    @InjectRepository(LeaveAllocation) private readonly allocations: Repository<LeaveAllocation>,
    private readonly balances: LeaveBalanceService,
    private readonly calendar: LeaveCalendar,
    private readonly employees: EmployeeService,
    private readonly audit: AuditService,
  ) {}

  listTypes() {
    return this.types.find({ order: { code: 'ASC' } });
  }

  // ---------- Tạo đơn (BR-01 → BR-04, BR-12, BR-16) ----------

  async create(dto: CreateLeaveRequestDto, idempotencyKey: string, actor: AuthUser, meta: RequestMeta = {}): Promise<LeaveRequestView> {
    const creator = this.requireEmployee(actor);
    const ownerId = dto.employeeId ?? creator;
    if (ownerId !== creator) {
      const owner = await this.balances.employeeFacts(this.requests.manager, ownerId);
      if (!owner) throw new BadRequestException('Không tìm thấy nhân viên được tạo đơn hộ');
      if (!canCreateFor(actor, ownerId, owner.managerId)) {
        throw new ForbiddenException('Chỉ HR hoặc quản lý trực tiếp được tạo đơn hộ (BR-12)');
      }
      if (owner.status === 'TERMINATED') throw new BadRequestException('Nhân viên đã nghỉ việc');
    }
    const period = { startDate: dto.startDate, endDate: dto.endDate, halfDay: dto.halfDay ?? null };

    // Gửi lại cùng Idempotency-Key (retry, bấm 2 lần) → trả đơn đã tạo, không tạo đơn mới (BR-11).
    const existing = await this.requests.findOneBy({ employeeId: ownerId, idempotencyKey });
    if (existing) return this.replay(existing, dto, actor);

    const type = await this.types.findOneBy({ code: dto.leaveType });
    if (!type) throw fieldError('leaveType', 'Loại phép không tồn tại');
    if (!isValidDate(period.startDate)) throw fieldError('startDate', 'Ngày bắt đầu không hợp lệ');
    if (!isValidDate(period.endDate)) throw fieldError('endDate', 'Ngày kết thúc không hợp lệ');
    if (period.endDate < period.startDate) throw fieldError('endDate', 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu');
    if (period.halfDay && period.startDate !== period.endDate) throw fieldError('halfDay', 'Nghỉ nửa ngày chỉ áp dụng cho một ngày');
    if (type.requiresEventDate) {
      if (!dto.eventDate || !isValidDate(dto.eventDate)) throw fieldError('eventDate', 'Loại phép theo sự kiện cần ngày sự kiện');
      if (!eventDateInRange(dto.eventDate, period.startDate)) throw fieldError('eventDate', 'Ngày sự kiện cách ngày nghỉ quá 1 năm');
    } else if (dto.eventDate) {
      throw fieldError('eventDate', 'Loại phép này không có ngày sự kiện');
    }

    try {
      const id = await this.requests.manager.transaction(async (m) => {
        // Khóa theo chủ đơn: hai request song song không cùng vượt qua kiểm tra trùng lịch và số dư.
        await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [ownerId]);
        const dup = await m.findOneBy(LeaveRequest, { employeeId: ownerId, idempotencyKey });
        if (dup) return dup.id;

        const holidays = await this.calendar.holidays(Number(period.startDate.slice(0, 4)), Number(period.endDate.slice(0, 4)), m);
        const days = leaveDays(period, holidays);
        if (days === 0) throw new BadRequestException('Khoảng nghỉ không có ngày làm việc nào (cuối tuần, ngày lễ hoặc nghỉ bù)');

        if (type.quotaKind === 'PER_EVENT') {
          if (exceedsEventLimit(type, period, days)) {
            const limit = type.maxDaysPerEvent != null ? `${type.maxDaysPerEvent} ngày` : `${type.maxMonthsPerEvent} tháng`;
            throw fieldError('endDate', `${type.name} tối đa ${limit} mỗi sự kiện (AC-3.1.4)`);
          }
          const same = await m.findOneBy(LeaveRequest, {
            employeeId: ownerId,
            leaveTypeId: type.id,
            eventDate: dto.eventDate!,
            status: In([...ACTIVE_STATUSES, 'COMPLETED']),
          });
          if (same) throw new ConflictException('Sự kiện này đã có đơn nghỉ (AC-3.2.6)');
        }

        const active = await m
          .createQueryBuilder(LeaveRequest, 'r')
          .where('r.employee_id = :ownerId AND r.status IN (:...st) AND r.start_date <= :end AND r.end_date >= :start', {
            ownerId,
            st: ACTIVE_STATUSES,
            start: period.startDate,
            end: period.endDate,
          })
          .getMany();
        const clash = active.find((r) => overlaps(period, r));
        if (clash) throw new ConflictException(`Trùng lịch với đơn ${clash.startDate} – ${clash.endDate} (BR-02)`);

        const allocations = type.quotaKind === 'PER_EVENT' ? [] : allocateByYear(period, holidays);
        if (allocations.length) await this.balances.reserve(m, ownerId, type, allocations);

        const ownerIsCeo = await this.employees.isCeo(ownerId);
        const saved = await m.save(
          m.create(LeaveRequest, {
            employeeId: ownerId,
            createdBy: creator,
            leaveTypeId: type.id,
            startDate: period.startDate,
            endDate: period.endDate,
            halfDay: period.halfDay,
            eventDate: dto.eventDate ?? null,
            days,
            reason: dto.reason ?? null,
            status: 'SUBMITTED',
            requiresHrApproval: needsHrApproval(type, days, ownerIsCeo),
            approverId: null,
            stageEnteredAt: new Date(),
            idempotencyKey,
          }),
        );
        for (const a of allocations) await m.insert(LeaveAllocation, { requestId: saved.id, year: a.year, days: a.days });
        await m.insert(LeaveRequestHistory, { requestId: saved.id, action: 'SUBMIT', fromStatus: null, toStatus: 'SUBMITTED', actorId: creator, comment: null });
        await this.audit.record(
          {
            actorId: creator,
            action: 'LEAVE_SUBMIT',
            entityType: 'leave_request',
            entityId: saved.id,
            changedFields: { leaveType: type.code, ...period, days, ...(ownerId !== creator ? { onBehalfOf: ownerId } : {}) },
            ...meta,
          },
          m,
        );
        await this.emit(m, 'LeaveRequested', saved, { onBehalf: ownerId !== creator, hrInvolved: ownerIsCeo });
        return saved.id;
      });
      return this.get(id, actor);
    } catch (e) {
      if (e instanceof QueryFailedError && (e as any).code === '23505') {
        // Hai request cùng key đến gần như đồng thời, hoặc hai đơn cùng sự kiện (ux_leave_request_event).
        const again = await this.requests.findOneBy({ employeeId: ownerId, idempotencyKey });
        if (again) return this.replay(again, dto, actor);
        throw new ConflictException('Sự kiện này đã có đơn nghỉ (AC-3.2.6)');
      }
      throw e;
    }
  }

  // ---------- Duyệt, từ chối, HR duyệt thêm, hủy, đề nghị hủy, hoàn tất (BR-05 → BR-11, BR-16) ----------

  async act(
    id: string,
    action: Exclude<LeaveAction, 'systemCancel'>,
    dto: LeaveDecisionDto | CancelRequestDto,
    actor: AuthUser,
    meta: RequestMeta = {},
  ): Promise<LeaveRequestView> {
    const comment = 'reason' in dto ? dto.reason : (dto.comment?.trim() || null);
    if (NEEDS_COMMENT.includes(action) && !comment) throw fieldError('comment', 'Cần nhập lý do');
    await this.requests.manager.transaction(async (m) => {
      const r = await m.findOne(LeaveRequest, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!r) throw new NotFoundException('Không tìm thấy đơn nghỉ');
      const facts = await this.facts(m, r);
      const rel = relation(actor, facts);
      if (!allowed(action, rel, facts)) throw new ForbiddenException('Không có quyền thực hiện thao tác này với đơn');

      const today = vnToday();
      const res = transition(
        { status: r.status, requiresHrApproval: r.requiresHrApproval, hasCancelRequest: !!r.cancelRequestedAt, started: today >= r.startDate, ended: today > r.endDate },
        action,
      );
      if (res.kind === 'unchanged') return; // BR-11: gửi lặp cùng quyết định không đổi gì
      if (res.kind === 'conflict') throw new ConflictException(res.reason);
      if (dto.version !== r.version) throw new ConflictException('Đơn đã được người khác cập nhật, hãy tải lại');
      await this.applyTransition(m, r, action, res.to, res.history, res.balance, actor.employeeId, comment, meta);
    });
    return this.get(id, actor);
  }

  /** Ghi một bước chuyển: số dư từng năm, trạng thái, lịch sử, audit (không ghi chú, BR-14), outbox. */
  private async applyTransition(
    m: EntityManager,
    r: LeaveRequest,
    action: LeaveAction,
    to: LeaveStatus,
    historyAction: import('./leave-state-machine').HistoryAction,
    balance: 'none' | 'release' | 'consume',
    actorId: string | null,
    comment: string | null,
    meta: RequestMeta,
  ) {
    const type = await m.findOneByOrFail(LeaveType, { id: r.leaveTypeId });
    const allocations = await m.find(LeaveAllocation, { where: { requestId: r.id }, order: { year: 'ASC' } });
    if (balance !== 'none' && allocations.length) await this.balances.apply(m, r.employeeId, type, allocations, balance, actorId);

    const from = r.status;
    const hadCancelRequest = !!r.cancelRequestedAt;
    r.status = to;
    if (['approve', 'reject', 'hrApprove', 'hrReject'].includes(action)) r.approverId = actorId;
    if (to !== from) {
      // Đổi giai đoạn chờ thì tính lại mốc nhắc (BR-17).
      r.stageEnteredAt = new Date();
      r.remindedAt = null;
    }
    if (action === 'cancelRequest') {
      r.cancelRequestedAt = new Date();
      r.cancelRequestedBy = actorId;
    } else if (action === 'cancelRequestReject' || to === 'CANCELLED') {
      r.cancelRequestedAt = null;
      r.cancelRequestedBy = null;
    }
    await m.save(r);
    await m.insert(LeaveRequestHistory, { requestId: r.id, action: historyAction, fromStatus: from, toStatus: to, actorId, comment });
    await this.audit.record(
      {
        actorId,
        action: AUDIT_ACTION[action],
        entityType: 'leave_request',
        entityId: r.id,
        changedFields: { status: { from, to }, days: r.days, ...(action === 'systemCancel' ? { reason: 'TERMINATED' } : {}) },
        ...meta,
      },
      m,
    );

    // Ngày nghỉ không lương đã duyệt làm giảm tháng được tính phép năm (13.2 (a), chốt 21/11).
    const approvedNow = to === 'APPROVED' && from !== 'APPROVED';
    const unapproved = from === 'APPROVED' && to === 'CANCELLED';
    if (type.code === 'UNPAID' && (approvedNow || unapproved)) {
      for (let y = Number(r.startDate.slice(0, 4)); y <= Number(r.endDate.slice(0, 4)); y++) {
        await this.balances.recalcAnnual(m, r.employeeId, y, actorId);
      }
    }

    const ceo = await this.employees.isCeo(r.employeeId);
    const hrInvolved = r.requiresHrApproval || ceo;
    const cancel = (reason: CancelReason, hr: boolean) => this.emit(m, 'LeaveCancelled', r, { reason, hrInvolved: hr });
    switch (action) {
      case 'approve':
        return this.emit(m, to === 'PENDING_HR' ? 'LeaveManagerApproved' : 'LeaveApproved', r, {});
      case 'reject':
        return this.emit(m, 'LeaveRejected', r, {});
      case 'hrApprove':
        return this.emit(m, 'LeaveHrApproved', r, {});
      case 'hrReject':
        return this.emit(m, 'LeaveHrRejected', r, {});
      case 'cancel':
        return cancel('OWNER', from === 'PENDING_HR' || ceo);
      case 'cancelRequest':
        return this.emit(m, 'LeaveCancelRequested', r, { hrInvolved });
      case 'cancelRequestApprove':
        return cancel('CANCEL_REQUEST_APPROVED', hrInvolved && hadCancelRequest);
      case 'cancelRequestReject':
        return this.emit(m, 'LeaveCancelRequestRejected', r, {});
      case 'complete':
        return this.emit(m, 'LeaveCompleted', r, {});
      case 'systemCancel':
        return cancel('SYSTEM', hrInvolved);
    }
  }

  /** Hệ thống hủy đơn của người nghỉ việc (AC-3.1.7). Gọi từ job; trả về true nếu đã hủy. */
  async systemCancel(m: EntityManager, id: string): Promise<boolean> {
    const r = await m.findOne(LeaveRequest, { where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!r) return false;
    const res = transition({ status: r.status, requiresHrApproval: r.requiresHrApproval, hasCancelRequest: false, started: false, ended: false }, 'systemCancel');
    if (res.kind !== 'changed') return false;
    await this.applyTransition(m, r, 'systemCancel', res.to, res.history, res.balance, null, 'Nhân viên nghỉ việc', {});
    return true;
  }

  // ---------- Tính lại theo lịch lễ mới (BR-19, UC4 13.6) ----------

  async recalculate(id: string, dto: RecalculateDto, actor: AuthUser, meta: RequestMeta = {}): Promise<LeaveRequestView> {
    await this.requests.manager.transaction(async (m) => {
      const r = await m.findOne(LeaveRequest, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!r) throw new NotFoundException('Không tìm thấy đơn nghỉ');
      const facts = await this.facts(m, r);
      if (!allowed('recalculate', relation(actor, facts), facts)) throw new ForbiddenException('Chỉ HR tính lại đơn');
      if (!ACTIVE_STATUSES.includes(r.status)) throw new ConflictException('Chỉ tính lại đơn đang chờ hoặc đã duyệt (E18)');
      if (dto.version !== r.version) throw new ConflictException('Đơn đã được người khác cập nhật, hãy tải lại');
      const type = await m.findOneByOrFail(LeaveType, { id: r.leaveTypeId });
      const holidays = await this.calendar.holidays(Number(r.startDate.slice(0, 4)), Number(r.endDate.slice(0, 4)), m);
      const days = leaveDays(r, holidays);
      if (days === 0) throw new ConflictException('Số ngày mới bằng 0; hủy đơn theo luồng khác (E18)');
      if (days === r.days) return;
      const old = await m.find(LeaveAllocation, { where: { requestId: r.id } });
      const next = type.quotaKind === 'PER_EVENT' ? [] : allocateByYear(r, holidays);
      // Đơn còn hiệu lực đều đang giữ `pending`: trả phân bổ cũ rồi giữ chỗ lại theo phân bổ mới (thiếu số dư thì E18).
      if (old.length) await this.balances.apply(m, r.employeeId, type, old, 'release', actor.employeeId);
      try {
        if (next.length) await this.balances.reserve(m, r.employeeId, type, next);
      } catch (e) {
        if (e instanceof BadRequestException) throw new ConflictException(`${(e.getResponse() as any).message ?? e.message} (E18)`);
        throw e;
      }
      await m.delete(LeaveAllocation, { requestId: r.id });
      for (const a of next) await m.insert(LeaveAllocation, { requestId: r.id, year: a.year, days: a.days });
      const before = r.days;
      r.days = days;
      await m.save(r);
      await m.insert(LeaveRequestHistory, {
        requestId: r.id,
        action: 'RECALCULATE',
        fromStatus: r.status,
        toStatus: r.status,
        actorId: actor.employeeId,
        comment: `${before} → ${days} ngày. ${dto.reason}`,
      });
      await this.audit.record(
        { actorId: actor.employeeId, action: 'LEAVE_RECALCULATE', entityType: 'leave_request', entityId: r.id, changedFields: { days: { from: before, to: days } }, ...meta },
        m,
      );
      await this.emit(m, 'LeaveRecalculated', r, {});
    });
    return this.get(id, actor);
  }

  /** Đơn còn hiệu lực có số ngày đã lưu khác số ngày tính theo lịch hiện tại (UC4 9.3). */
  async affectedByHolidays(year: number) {
    const rows = await this.requests
      .createQueryBuilder('r')
      .where('r.status IN (:...st)', { st: ACTIVE_STATUSES })
      .andWhere('r.start_date <= :to AND r.end_date >= :from', { from: `${year}-01-01`, to: `${year}-12-31` })
      .orderBy('r.start_date')
      .getMany();
    const out: { id: string; employeeId: string; employeeName: string | null; startDate: string; endDate: string; status: LeaveStatus; version: number; storedDays: number; recalculatedDays: number }[] = [];
    for (const r of rows) {
      const holidays = await this.calendar.holidays(Number(r.startDate.slice(0, 4)), Number(r.endDate.slice(0, 4)));
      const d = leaveDays(r, holidays);
      if (d !== r.days) out.push({ id: r.id, employeeId: r.employeeId, employeeName: null, startDate: r.startDate, endDate: r.endDate, status: r.status, version: r.version, storedDays: r.days, recalculatedDays: d });
    }
    const names = await this.employees.namesOf(out.map((o) => o.employeeId));
    out.forEach((o) => (o.employeeName = names.get(o.employeeId) ?? null));
    return out;
  }

  /** Số đơn bị ảnh hưởng khi thêm, xóa ngày `date` (đơn còn hiệu lực có chứa ngày đó). */
  async countCovering(m: EntityManager, date: string): Promise<number> {
    const [row] = await m.query(
      `SELECT count(*)::int AS n FROM leave.leave_request WHERE status = ANY($1) AND start_date <= $2 AND end_date >= $2`,
      [ACTIVE_STATUSES, date],
    );
    return row.n;
  }

  // ---------- Xem đơn ----------

  /**
   * Chi tiết đơn. `auditReason`: chỉ `GET /leave-requests/{id}` là HR chủ động xem, mới ghi `VIEW_LEAVE_REASON`; response trả về
   * sau một thao tác (duyệt, hủy…) không ghi thêm (review #120).
   */
  async get(id: string, actor: AuthUser, auditReason = false): Promise<LeaveRequestView> {
    const r = await this.requests.findOneBy({ id });
    if (!r) throw new NotFoundException('Không tìm thấy đơn nghỉ');
    const facts = await this.facts(this.requests.manager, r);
    const rel = relation(actor, facts);
    if (!canView(rel)) throw new ForbiddenException('Không có quyền xem đơn này');
    const view = await this.detail(r, rel);
    if (auditReason && view.reason && PRIVATE_REASON_TYPES.includes(view.leaveType ?? '') && !rel.has('OWNER')) {
      // HR đọc lý do nghỉ ốm, thai sản: ghi ai đọc đơn nào, không ghi nội dung (BR-14, AC-4.7.4).
      await this.audit.record({ actorId: actor.employeeId, action: 'VIEW_LEAVE_REASON', entityType: 'leave_request', entityId: r.id, changedFields: { field: 'reason' } });
    }
    const today = vnToday();
    const started = today >= r.startDate;
    view.canDecide = r.status === 'SUBMITTED' && isApprover(rel, facts);
    view.canHrDecide = r.status === 'PENDING_HR' && allowed('hrApprove', rel, facts);
    view.canCancel = (r.status === 'SUBMITTED' || r.status === 'PENDING_HR') && rel.has('OWNER') && !started;
    view.canRequestCancel = r.status === 'APPROVED' && rel.has('OWNER') && !r.cancelRequestedAt && !started;
    view.canConfirmCancel = r.status === 'APPROVED' && !!r.cancelRequestedAt && !started && allowed('cancelRequestApprove', rel, facts);
    view.canComplete = r.status === 'APPROVED' && today > r.endDate && allowed('complete', rel, facts);
    return view;
  }

  mine(actor: AuthUser, q: LeaveRequestQuery): Promise<Page<LeaveRequestView>> {
    const me = this.requireEmployee(actor);
    return this.page((qb) => qb.where('r.employee_id = :me', { me }), q, actor);
  }

  /**
   * Việc cần duyệt (UC4 9.3): đơn `SUBMITTED` của cấp dưới trực tiếp và của quản lý đang giao cho người gọi (BR-06), đơn của
   * CEO với HR; cộng đơn `APPROVED` có đề nghị hủy mà người gọi xác nhận được. Quản lý gián tiếp, trưởng, phó không thấy.
   */
  async pendingApproval(actor: AuthUser, q: LeaveRequestQuery): Promise<Page<LeaveRequestView>> {
    const me = this.requireEmployee(actor);
    const direct = await this.employees.directReportIds(me);
    const managers = await this.delegatedManagers(me);
    const viaDelegation = new Set<string>();
    for (const mgr of managers) (await this.employees.directReportIds(mgr)).filter((id) => id !== me).forEach((id) => viaDelegation.add(id));
    const ceo = hasRole(actor, 'HR') ? (await this.employees.ceoIds()).filter((id) => id !== me) : [];
    const owners = [...new Set([...direct, ...viaDelegation, ...ceo])];
    if (!owners.length) return { items: [], page: q.page, size: q.size, total: 0 };
    const page = await this.page(
      (qb) =>
        qb
          .where('r.employee_id IN (:...owners)', { owners })
          .andWhere(
            new Brackets((b) =>
              b
                .where(`r.status = 'SUBMITTED'`)
                .orWhere(`r.status = 'APPROVED' AND r.cancel_requested_at IS NOT NULL AND r.requires_hr_approval = false AND r.employee_id NOT IN (:...ceoOwners)`, {
                  ceoOwners: ceo.length ? ceo : ['00000000-0000-0000-0000-000000000000'],
                }),
            ),
          ),
      { ...q, status: undefined } as LeaveRequestQuery,
      actor,
      'queue',
    );
    page.items.forEach((v) => (v.viaDelegation = viaDelegation.has(v.employeeId) && !direct.includes(v.employeeId)));
    return page;
  }

  /**
   * HR: đơn `PENDING_HR` và mọi đề nghị hủy đơn đã duyệt (HR được xác nhận mọi đề nghị hủy, UC4 13.7; đơn đã qua HR, đơn của CEO
   * thì chỉ HR), trừ đơn của chính mình.
   */
  pendingHr(actor: AuthUser, q: LeaveRequestQuery): Promise<Page<LeaveRequestView>> {
    const me = this.requireEmployee(actor);
    return this.page(
      (qb) =>
        qb.where('r.employee_id <> :me', { me }).andWhere(
          new Brackets((b) => b.where(`r.status = 'PENDING_HR'`).orWhere(`r.status = 'APPROVED' AND r.cancel_requested_at IS NOT NULL`)),
        ),
      { ...q, status: undefined } as LeaveRequestQuery,
      actor,
      'queue',
    );
  }

  /** HR xem toàn bộ đơn, mặc định là đơn đã duyệt chờ hoàn tất (BR-10). */
  all(q: LeaveRequestQuery, actor: AuthUser): Promise<Page<LeaveRequestView>> {
    return this.page((qb) => qb.where('1 = 1'), { ...q, status: q.status ?? 'APPROVED' } as LeaveRequestQuery, actor);
  }

  // ---------- Nội bộ ----------

  private requireEmployee(actor: AuthUser): string {
    if (!actor.employeeId) throw new ForbiddenException('Tài khoản chưa gắn với hồ sơ nhân viên');
    return actor.employeeId;
  }

  async facts(m: EntityManager, r: LeaveRequest): Promise<RequestFacts> {
    const [row] = await m.query(`SELECT manager_id FROM employee.employee WHERE id = $1`, [r.employeeId]);
    const ownerManagerId: string | null = row?.manager_id ?? null;
    return {
      ownerId: r.employeeId,
      ownerManagerId,
      ownerIsCeo: await this.employees.isCeo(r.employeeId),
      activeDelegateIds: ownerManagerId ? await this.activeDelegates(m, ownerManagerId) : [],
      requiresHrApproval: r.requiresHrApproval,
    };
  }

  /** Người đang duyệt thay `managerId` hôm nay (BR-06). */
  async activeDelegates(m: EntityManager, managerId: string): Promise<string[]> {
    const rows: { delegate_id: string }[] = await m.query(
      `SELECT delegate_id FROM leave.approval_delegation WHERE manager_id = $1 AND ended_at IS NULL AND start_date <= $2 AND end_date >= $2`,
      [managerId, vnToday()],
    );
    return rows.map((x) => x.delegate_id);
  }

  private async delegatedManagers(delegateId: string): Promise<string[]> {
    const rows: { manager_id: string }[] = await this.requests.manager.query(
      `SELECT manager_id FROM leave.approval_delegation WHERE delegate_id = $1 AND ended_at IS NULL AND start_date <= $2 AND end_date >= $2`,
      [delegateId, vnToday()],
    );
    return rows.map((x) => x.manager_id);
  }

  private async replay(existing: LeaveRequest, dto: CreateLeaveRequestDto, actor: AuthUser): Promise<LeaveRequestView> {
    const type = await this.types.findOneBy({ code: dto.leaveType });
    const same =
      existing.leaveTypeId === type?.id &&
      existing.startDate === dto.startDate &&
      existing.endDate === dto.endDate &&
      existing.halfDay === (dto.halfDay ?? null) &&
      existing.eventDate === (dto.eventDate ?? null);
    if (!same) throw new ConflictException('Idempotency-Key đã được dùng cho một đơn khác');
    return this.get(existing.id, actor);
  }

  /** Chi tiết kèm lịch sử (FR-4.7). Gọi sau khi đã kiểm tra quyền xem. */
  private async detail(r: LeaveRequest, rel: Set<Relation>): Promise<LeaveRequestView> {
    const history = await this.history.find({ where: { requestId: r.id }, order: { at: 'ASC', id: 'ASC' } });
    const names = await this.employees.namesOf([r.employeeId, ...history.map((h) => h.actorId).filter((x): x is string => !!x)]);
    const [view] = await this.toViews([r], names, () => rel);
    view.history = history.map((h) => ({
      action: h.action,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      actorId: h.actorId,
      actorName: h.actorId ? (names.get(h.actorId) ?? null) : null,
      comment: h.comment,
      at: h.at,
    }));
    return view;
  }

  private async page(
    filter: (qb: SelectQueryBuilder<LeaveRequest>) => SelectQueryBuilder<LeaveRequest>,
    q: LeaveRequestQuery,
    actor: AuthUser,
    mode: 'list' | 'queue' = 'list',
  ): Promise<Page<LeaveRequestView>> {
    const qb = filter(this.requests.createQueryBuilder('r'));
    if (q.status) qb.andWhere('r.status = :status', { status: q.status });
    qb.orderBy(mode === 'queue' ? 'r.stage_entered_at' : 'r.start_date', mode === 'queue' ? 'ASC' : 'DESC')
      .addOrderBy('r.created_at', 'DESC')
      .skip((q.page - 1) * q.size)
      .take(q.size);
    const [rows, total] = await qb.getManyAndCount();
    const names = await this.employees.namesOf(rows.map((r) => r.employeeId));
    // Danh sách: lý do nghỉ ốm, thai sản chỉ hiện cho chủ đơn; HR xem ở trang chi tiết (có audit).
    const items = await this.toViews(rows, names, (r) => (actor.employeeId === r.employeeId ? new Set<Relation>(['OWNER']) : new Set<Relation>()));
    if (mode === 'queue') {
      const holidays = await this.calendar.holidays(Number(vnToday().slice(0, 4)) - 1, Number(vnToday().slice(0, 4)) + 1);
      const now = new Date();
      items.forEach((v, i) => {
        v.kind = rows[i]!.status === 'APPROVED' ? 'CANCEL_REQUEST' : 'DECISION';
        v.overdue = v.kind === 'DECISION' && reminderDueAt(rows[i]!.stageEnteredAt, holidays) <= now;
      });
    }
    return { items, page: q.page, size: q.size, total };
  }

  private async toViews(rows: LeaveRequest[], names: Map<string, string>, relOf: (r: LeaveRequest) => Set<Relation>): Promise<LeaveRequestView[]> {
    if (!rows.length) return [];
    const types = new Map((await this.types.find()).map((t) => [t.id, t]));
    const allocs = await this.allocations.find({ where: { requestId: In(rows.map((r) => r.id)) }, order: { year: 'ASC' } });
    return rows.map((r) => {
      const t = types.get(r.leaveTypeId);
      const showReason = canSeeReason(relOf(r), t?.code ?? '');
      return {
        id: r.id,
        employeeId: r.employeeId,
        employeeName: names.get(r.employeeId) ?? null,
        createdBy: r.createdBy,
        leaveType: t?.code ?? null,
        leaveTypeName: t?.name ?? null,
        startDate: r.startDate,
        endDate: r.endDate,
        halfDay: r.halfDay,
        eventDate: r.eventDate,
        days: r.days,
        allocations: allocs.filter((a) => a.requestId === r.id).map((a) => ({ year: a.year, days: a.days })),
        reason: showReason ? r.reason : null,
        reasonHidden: !showReason && !!r.reason,
        status: r.status,
        requiresHrApproval: r.requiresHrApproval,
        approverId: r.approverId,
        cancelRequest: r.cancelRequestedAt ? { requestedAt: r.cancelRequestedAt, requestedBy: r.cancelRequestedBy } : null,
        completableFrom: completableFrom(r.endDate),
        version: r.version,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });
  }

  /** Ghi event vào outbox trong cùng giao dịch; payload chỉ để định tuyến (BR-15). */
  private async emit(m: EntityManager, eventType: LeaveEventType, r: LeaveRequest, extra: Omit<LeaveEventPayload, 'requestId' | 'employeeId' | 'occurredAt'>) {
    await m.insert(OutboxEvent, {
      eventType,
      aggregateId: r.id,
      payload: { requestId: r.id, employeeId: r.employeeId, occurredAt: new Date().toISOString(), ...extra },
    });
  }
}
