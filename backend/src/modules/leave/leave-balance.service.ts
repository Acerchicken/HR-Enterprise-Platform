import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { seniority } from '../employee/profile-computed';
import { vnToday } from '../employee/transfer-rules';
import { LeaveBalance } from './leave-balance.entity';
import { LeaveCalendar } from './leave-calendar';
import { addDays, annualEntitlement, availableDays, BalanceAmounts, carryOver, isWorkingDay } from './leave-rules';
import { LeaveType } from './leave-type.entity';

export interface EmployeeFacts {
  id: string;
  hireDate: string;
  status: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED';
  managerId: string | null;
  /** Ngày làm việc cuối: `effective_to` của giai đoạn công tác đã đóng (UC2 FR-2.8). */
  terminationDate: string | null;
}

export interface BalanceView {
  leaveType: string;
  leaveTypeName: string;
  year: number;
  entitled: number;
  carriedIn: number;
  used: number;
  pending: number;
  available: number;
  source: string;
  baseDays?: number | null;
  note?: string | null;
  version?: number;
}

/** Hiệu ứng lên số dư của các dòng phân bổ: giữ chỗ khi gửi, trả khi hủy/từ chối, chuyển sang đã dùng khi hoàn tất. */
export type AllocationEffect = 'reserve' | 'release' | 'consume';

const amounts = (b: LeaveBalance): BalanceAmounts => ({ entitled: b.entitled, carriedIn: b.carriedIn, used: b.used, pending: b.pending });

/**
 * Số dư phép (UC3 spec 13.2 → 13.4): cấp, tính lại phép năm, chuyển phép, giữ chỗ theo từng năm, HR chỉnh hạn mức (FR-3.8).
 * Mọi hàm ghi nhận `m` để chạy trong giao dịch của thao tác gọi nó.
 */
@Injectable()
export class LeaveBalanceService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly calendar: LeaveCalendar,
    private readonly audit: AuditService,
  ) {}

  /** Đọc thẳng hồ sơ (đọc chéo schema `employee`, database-schema.md mục 9) để không phụ thuộc vòng với module Employee. */
  async employeeFacts(m: EntityManager | DataSource, id: string): Promise<EmployeeFacts | null> {
    const [e] = await m.query(
      `SELECT e.id, to_char(e.hire_date, 'YYYY-MM-DD') AS hire_date, e.status, e.manager_id,
              (SELECT to_char(max(a.effective_to), 'YYYY-MM-DD') FROM employee.employment_assignment a
                WHERE a.employee_id = e.id AND a.status = 'CLOSED') AS closed_to,
              to_char(e.updated_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS updated_on
         FROM employee.employee e WHERE e.id = $1`,
      [id],
    );
    if (!e) return null;
    return {
      id: e.id,
      hireDate: e.hire_date,
      status: e.status,
      managerId: e.manager_id,
      terminationDate: e.status === 'TERMINATED' ? (e.closed_to ?? e.updated_on) : null,
    };
  }

  async types(m: EntityManager | DataSource = this.ds): Promise<LeaveType[]> {
    return m.getRepository(LeaveType).find({ order: { code: 'ASC' } });
  }

  // ---------- Đọc số dư ----------

  async view(employeeId: string, year: number, withHrFields: boolean): Promise<BalanceView[]> {
    await this.ds.transaction((m) => this.ensureYear(m, employeeId, year));
    const types = new Map((await this.types()).map((t) => [t.id, t]));
    const rows = await this.ds.getRepository(LeaveBalance).find({ where: { employeeId, year } });
    return rows
      .filter((b) => types.get(b.leaveTypeId)?.quotaKind !== 'PER_EVENT')
      .map((b) => {
        const t = types.get(b.leaveTypeId)!;
        return {
          leaveType: t.code,
          leaveTypeName: t.name,
          year: b.year,
          entitled: b.entitled,
          carriedIn: b.carriedIn,
          used: b.used,
          pending: b.pending,
          available: availableDays(amounts(b)),
          source: b.source,
          ...(withHrFields ? { baseDays: b.baseDays, note: b.note, version: b.version } : {}),
        };
      })
      .sort((a, b) => a.leaveType.localeCompare(b.leaveType));
  }

  // ---------- Cấp, tính lại ----------

  /**
   * Tạo các dòng số dư còn thiếu của năm (13.2 "Đọc số dư, tạo đơn"): `ANNUAL` theo công thức và chuyển phép; `SICK`,
   * `UNPAID` theo mặc định của loại (`DEFAULT`). Người chưa vào làm hoặc đã nghỉ trước năm đó không có dòng phép năm.
   */
  async ensureYear(m: EntityManager, employeeId: string, year: number): Promise<void> {
    const e = await this.employeeFacts(m, employeeId);
    if (!e) throw new NotFoundException('Không tìm thấy nhân viên');
    for (const t of await this.types(m)) {
      if (t.quotaKind === 'YEARLY') {
        await m.query(
          `INSERT INTO leave.leave_balance (employee_id, leave_type_id, year, entitled, used, pending, source)
           VALUES ($1, $2, $3, $4, 0, 0, 'DEFAULT') ON CONFLICT DO NOTHING`,
          [employeeId, t.id, year, t.maxDaysPerYear],
        );
      } else if (t.quotaKind === 'ACCRUED') {
        // Năm trước chưa có dòng (chưa ai mở số dư năm đó) thì tạo trước để chuyển phép đúng; chỉ lùi một năm.
        await this.ensureAnnual(m, e, t, year - 1, false);
        await this.ensureAnnual(m, e, t, year, true);
      }
    }
  }

  private async ensureAnnual(m: EntityManager, e: EmployeeFacts, t: LeaveType, year: number, withCarry: boolean) {
    if (e.hireDate > `${year}-12-31` || (e.terminationDate && e.terminationDate < `${year}-01-01`)) return;
    const exists = await m.query(`SELECT 1 FROM leave.leave_balance WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3`, [e.id, t.id, year]);
    if (exists.length) return;
    const entitled = await this.computeAnnual(m, e, year, null);
    const carried = withCarry ? await this.carryFrom(m, e.id, t.id, year - 1) : 0;
    await m.query(
      `INSERT INTO leave.leave_balance (employee_id, leave_type_id, year, entitled, carried_in, used, pending, source)
       VALUES ($1, $2, $3, $4, $5, 0, 0, 'AUTO') ON CONFLICT DO NOTHING`,
      [e.id, t.id, year, entitled, carried],
    );
  }

  /** Phép năm theo BR-01 cho `e` trong `year`, mức nền `baseDays` (null = 12). */
  async computeAnnual(m: EntityManager, e: EmployeeFacts, year: number, baseDays: number | null): Promise<number> {
    const holidays = await this.calendar.holidays(year, year, m);
    const unpaid: { start_date: string; end_date: string; half_day: string | null }[] = await m.query(
      `SELECT to_char(r.start_date, 'YYYY-MM-DD') AS start_date, to_char(r.end_date, 'YYYY-MM-DD') AS end_date, r.half_day
         FROM leave.leave_request r JOIN leave.leave_type t ON t.id = r.leave_type_id
        WHERE r.employee_id = $1 AND t.code = 'UNPAID' AND r.status IN ('APPROVED', 'COMPLETED')
          AND r.start_date <= $3 AND r.end_date >= $2`,
      [e.id, `${year}-01-01`, `${year}-12-31`],
    );
    const unpaidDays = new Map<string, number>();
    for (const u of unpaid) {
      for (let d = u.start_date; d <= u.end_date; d = addDays(d, 1)) {
        if (isWorkingDay(d, holidays)) unpaidDays.set(d, u.half_day ? 0.5 : 1);
      }
    }
    return annualEntitlement({
      year,
      hireDate: e.hireDate,
      terminationDate: e.terminationDate,
      baseDays,
      seniorityBonus: seniority(e.hireDate, `${year}-12-31`).annualLeaveBonus,
      holidays,
      unpaidDays,
    });
  }

  private async carryFrom(m: EntityManager, employeeId: string, typeId: string, prevYear: number): Promise<number> {
    const prev = await m.getRepository(LeaveBalance).findOneBy({ employeeId, leaveTypeId: typeId, year: prevYear });
    return prev ? carryOver(amounts(prev)) : 0;
  }

  /**
   * Tính lại phép năm `year` (job hằng ngày, sửa `hireDate`, nghỉ việc, HR đổi mức nền) rồi chuyển phép sang năm sau.
   * `entitled` mới nhỏ hơn số đã giữ, đã dùng thì giữ CHECK bằng cách không hạ dưới đó và ghi `LEAVE_BALANCE_OVERDRAWN`.
   */
  async recalcAnnual(m: EntityManager, employeeId: string, year: number, actorId: string | null): Promise<void> {
    const annual = await m.getRepository(LeaveType).findOneByOrFail({ code: 'ANNUAL' });
    const e = await this.employeeFacts(m, employeeId);
    if (!e) return;
    const b = await m.getRepository(LeaveBalance).findOne({ where: { employeeId, leaveTypeId: annual.id, year }, lock: { mode: 'pessimistic_write' } });
    if (!b) return;
    const computed = await this.computeAnnual(m, e, year, b.baseDays);
    const carried = await this.carryFrom(m, employeeId, annual.id, year - 1);
    await this.writeAnnual(m, b, computed, carried, actorId);
    await this.refreshCarry(m, employeeId, annual.id, year + 1, actorId, false);
  }

  private async writeAnnual(m: EntityManager, b: LeaveBalance, entitled: number, carried: number, actorId: string | null) {
    if (b.entitled === entitled && b.carriedIn === carried) return;
    const need = b.used + b.pending;
    let ent = entitled;
    if (need > ent + carried) {
      ent = Math.round((need - carried) * 100) / 100;
      await this.audit.record(
        {
          actorId,
          action: 'LEAVE_BALANCE_OVERDRAWN',
          entityType: 'leave_balance',
          entityId: b.employeeId,
          changedFields: { leaveType: 'ANNUAL', year: b.year, computed: entitled, carriedIn: carried, usedAndPending: need },
        },
        m,
      );
    }
    await m.query(
      `UPDATE leave.leave_balance SET entitled = $4, carried_in = $5 WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3`,
      [b.employeeId, b.leaveTypeId, b.year, ent, carried],
    );
  }

  /**
   * Đặt lại `carried_in` của `year` theo năm trước (AC-3.1.8). `strict` (khi gửi đơn có ngày ở năm trước): phần chuyển sang
   * đã được dùng ở năm sau thì từ chối, không để năm sau âm.
   */
  async refreshCarry(m: EntityManager, employeeId: string, typeId: string, year: number, actorId: string | null, strict: boolean) {
    const b = await m.getRepository(LeaveBalance).findOne({ where: { employeeId, leaveTypeId: typeId, year }, lock: { mode: 'pessimistic_write' } });
    if (!b) return;
    const carried = await this.carryFrom(m, employeeId, typeId, year - 1);
    if (carried === b.carriedIn) return;
    if (strict && b.used + b.pending > b.entitled + carried) {
      throw new BadRequestException(`Không đủ số dư: phần phép năm ${year - 1} chuyển sang năm ${year} đã được dùng`);
    }
    await this.writeAnnual(m, b, b.entitled, carried, actorId);
  }

  // ---------- Giữ chỗ theo năm ----------

  /** Khóa dòng số dư theo năm tăng dần (không khóa chéo) và kiểm từng năm đủ số dư (BR-01, AC-3.2.4). */
  async reserve(m: EntityManager, employeeId: string, type: LeaveType, allocations: { year: number; days: number }[]) {
    for (const a of [...allocations].sort((x, y) => x.year - y.year)) {
      await this.ensureYear(m, employeeId, a.year);
      const b = await m.getRepository(LeaveBalance).findOne({
        where: { employeeId, leaveTypeId: type.id, year: a.year },
        lock: { mode: 'pessimistic_write' },
      });
      const available = b ? availableDays(amounts(b)) : 0;
      if (a.days > available) {
        const where = allocations.length > 1 ? ` năm ${a.year}` : '';
        throw new BadRequestException(`Không đủ số dư${where}: cần ${a.days} ngày, còn ${available} ngày`);
      }
    }
    await this.apply(m, employeeId, type, allocations, 'reserve', null);
  }

  async apply(
    m: EntityManager,
    employeeId: string,
    type: LeaveType,
    allocations: { year: number; days: number }[],
    effect: AllocationEffect,
    actorId: string | null,
  ) {
    for (const a of [...allocations].sort((x, y) => x.year - y.year)) {
      const [dp, du] = effect === 'reserve' ? [a.days, 0] : effect === 'release' ? [-a.days, 0] : [-a.days, a.days];
      await m.query(
        `UPDATE leave.leave_balance SET pending = pending + $4, used = used + $5
          WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3`,
        [employeeId, type.id, a.year, dp, du],
      );
      if (type.quotaKind === 'ACCRUED' && effect !== 'consume') {
        await this.refreshCarry(m, employeeId, type.id, a.year + 1, actorId, effect === 'reserve');
      }
    }
  }

  // ---------- HR chỉnh hạn mức (FR-3.8) ----------

  async adjust(
    employeeId: string,
    code: string,
    year: number,
    dto: { version: number; baseDays?: number; entitled?: number; note: string },
    actorId: string | null,
  ): Promise<BalanceView> {
    await this.ds.transaction(async (m) => {
      const type = await m.getRepository(LeaveType).findOneBy({ code });
      if (!type || type.quotaKind === 'PER_EVENT') throw new BadRequestException('Loại phép không có số dư');
      if (type.quotaKind === 'ACCRUED' && (dto.entitled !== undefined || dto.baseDays === undefined)) {
        throw new BadRequestException('Phép năm do hệ thống tính: chỉ đặt mức nền baseDays 12, 14 hoặc 16');
      }
      if (type.quotaKind === 'YEARLY' && (dto.baseDays !== undefined || dto.entitled === undefined)) {
        throw new BadRequestException('Loại phép này chỉ đặt hạn mức entitled');
      }
      await this.ensureYear(m, employeeId, year);
      const b = await m.getRepository(LeaveBalance).findOne({ where: { employeeId, leaveTypeId: type.id, year }, lock: { mode: 'pessimistic_write' } });
      if (!b) throw new NotFoundException('Nhân viên chưa có số dư loại phép này trong năm');
      if (b.version !== dto.version) throw new ConflictException('Số dư đã được người khác cập nhật, hãy tải lại');
      const before = { baseDays: b.baseDays, entitled: b.entitled };
      if (type.quotaKind === 'ACCRUED') {
        await m.query(`UPDATE leave.leave_balance SET base_days = $4 WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3`, [employeeId, type.id, year, dto.baseDays]);
        await this.recalcAnnual(m, employeeId, year, actorId);
      } else {
        if (dto.entitled! < b.used + b.pending) throw new ConflictException(`Hạn mức không được nhỏ hơn đã dùng và đang chờ (${b.used + b.pending})`);
        await m.query(`UPDATE leave.leave_balance SET entitled = $4, source = 'MANUAL' WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3`, [employeeId, type.id, year, dto.entitled]);
      }
      await m.query(
        `UPDATE leave.leave_balance SET note = $4, version = version + 1, updated_by = $5, updated_at = now()
          WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3`,
        [employeeId, type.id, year, dto.note, actorId],
      );
      const after = await m.getRepository(LeaveBalance).findOneByOrFail({ employeeId, leaveTypeId: type.id, year });
      await this.audit.record(
        {
          actorId,
          action: 'LEAVE_BALANCE_ADJUST',
          entityType: 'leave_balance',
          entityId: employeeId,
          // Không ghi ghi chú tự do (BR-14).
          changedFields: {
            leaveType: code,
            year,
            ...(type.quotaKind === 'ACCRUED' ? { baseDays: { from: before.baseDays, to: after.baseDays } } : {}),
            entitled: { from: before.entitled, to: after.entitled },
          },
        },
        m,
      );
    });
    return (await this.view(employeeId, year, true)).find((v) => v.leaveType === code)!;
  }

  /** Năm hiện tại theo giờ Việt Nam. */
  thisYear(): number {
    return Number(vnToday().slice(0, 4));
  }
}
