import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { vnToday } from '../employee/transfer-rules';
import { LeaveBalanceService } from './leave-balance.service';
import { LeaveCalendar } from './leave-calendar';
import { LeaveRequest } from './leave-request.entity';
import { reminderDueAt } from './leave-rules';
import { LeaveService } from './leave.service';
import { OutboxEvent } from './outbox/outbox.entity';

/**
 * Việc chạy nền của Leave (worker `LeaveJob`, UC3 13.2, UC4 13.5). Mỗi việc an toàn khi nhiều worker cùng chạy: khóa dòng
 * `FOR UPDATE SKIP LOCKED` hoặc `pg_try_advisory_lock`.
 */
@Injectable()
export class LeaveJobsService {
  private readonly logger = new Logger(LeaveJobsService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly leave: LeaveService,
    private readonly balances: LeaveBalanceService,
    private readonly calendar: LeaveCalendar,
  ) {}

  /**
   * Hồ sơ `TERMINATED` còn đơn chờ, hoặc đơn đã duyệt bắt đầu sau ngày nghỉ việc: hệ thống hủy, trả `pending` theo năm, rồi
   * tính lại phép năm tới tháng nghỉ việc (AC-3.1.7). Đơn đang diễn ra để HR xử lý.
   */
  async cancelForTerminated(): Promise<number> {
    const rows: { id: string; employee_id: string }[] = await this.ds.query(
      `WITH t AS (
         SELECT e.id, coalesce((SELECT max(a.effective_to) FROM employee.employment_assignment a
                                 WHERE a.employee_id = e.id AND a.status = 'CLOSED'), (e.updated_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) AS last_day
           FROM employee.employee e WHERE e.status = 'TERMINATED')
       SELECT r.id, r.employee_id FROM leave.leave_request r JOIN t ON t.id = r.employee_id
        WHERE r.status IN ('SUBMITTED', 'PENDING_HR') OR (r.status = 'APPROVED' AND r.start_date > t.last_day)
        ORDER BY r.employee_id LIMIT 200`,
    );
    let n = 0;
    const touched = new Set<string>();
    for (const r of rows) {
      const done = await this.ds.transaction(async (m) => {
        await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [r.employee_id]);
        return this.leave.systemCancel(m, r.id);
      });
      if (done) {
        n++;
        touched.add(r.employee_id);
      }
    }
    const year = Number(vnToday().slice(0, 4));
    for (const id of touched) await this.ds.transaction((m) => this.balances.recalcAnnual(m, id, year, null));
    return n;
  }

  /** Nhắc đơn chờ quá một ngày làm việc đầy đủ, một lần mỗi giai đoạn (BR-17). Không ghi lịch sử, không audit. */
  async sendReminders(now = new Date()): Promise<number> {
    const year = Number(vnToday(now).slice(0, 4));
    const holidays = await this.calendar.holidays(year - 1, year + 1);
    const candidates: { id: string; stage_entered_at: Date }[] = await this.ds.query(
      `SELECT id, stage_entered_at FROM leave.leave_request
        WHERE status IN ('SUBMITTED', 'PENDING_HR') AND reminded_at IS NULL AND stage_entered_at < $1
        ORDER BY stage_entered_at LIMIT 500`,
      [new Date(now.getTime() - 24 * 3600_000)],
    );
    let n = 0;
    for (const c of candidates.filter((x) => reminderDueAt(new Date(x.stage_entered_at), holidays) <= now)) {
      await this.ds.transaction(async (m) => {
        const [r]: LeaveRequest[] = await m
          .getRepository(LeaveRequest)
          .createQueryBuilder('r')
          .where('r.id = :id AND r.reminded_at IS NULL AND r.status IN (:...st)', { id: c.id, st: ['SUBMITTED', 'PENDING_HR'] })
          .setLock('pessimistic_write')
          .setOnLocked('skip_locked')
          .getMany();
        if (!r) return;
        await m.query(`UPDATE leave.leave_request SET reminded_at = now() WHERE id = $1`, [r.id]);
        await m.insert(OutboxEvent, {
          eventType: 'LeaveReminder',
          aggregateId: r.id,
          payload: { requestId: r.id, employeeId: r.employeeId, occurredAt: now.toISOString(), stage: r.status as 'SUBMITTED' | 'PENDING_HR' },
        });
        n++;
      });
    }
    return n;
  }

  /**
   * Một lần mỗi ngày (giờ Việt Nam): tạo dòng số dư năm hiện tại còn thiếu (đầu năm có chuyển phép) và tính lại phép năm,
   * bắt được sửa `hireDate`, mốc thâm niên, nghỉ việc (UC3 13.2). Chỉ đánh dấu ngày đã chạy (`notification.processed_event`) sau
   * khi chạy hết; worker chết giữa chừng thì lần sau chạy lại, an toàn vì tính lại là idempotent. `pg_try_advisory_lock` để
   * nhiều worker không chạy cùng lúc. `only`: giới hạn nhân viên (test).
   */
  async dailyBalances(now = new Date(), only?: string[]): Promise<number | null> {
    const today = vnToday(now);
    const markId = `leave-daily-${today}`;
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    try {
      const [{ ok }] = await qr.query(`SELECT pg_try_advisory_lock(hashtext('leave-daily-balances')) AS ok`);
      if (!ok) return null;
      try {
        if (!only && (await qr.query(`SELECT 1 FROM notification.processed_event WHERE event_id = $1`, [markId])).length) return null;
        const year = Number(today.slice(0, 4));
        const ids: { id: string }[] = await qr.query(
          `SELECT e.id FROM employee.employee e
            WHERE e.hire_date <= $2 AND ($3::uuid[] IS NULL OR e.id = ANY($3)) AND (e.status <> 'TERMINATED' OR EXISTS (
              SELECT 1 FROM leave.leave_balance b WHERE b.employee_id = e.id AND b.year = $1))`,
          [year, `${year}-12-31`, only ?? null],
        );
        let n = 0;
        for (const { id } of ids) {
          try {
            await this.ds.transaction(async (m) => {
              await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [id]);
              await this.balances.ensureYear(m, id, year);
              await this.balances.recalcAnnual(m, id, year, null);
            });
            n++;
          } catch (e) {
            this.logger.warn(`Tính lại số dư ${id} lỗi: ${(e as Error).message}`);
          }
        }
        if (!only) {
          await qr.query(`INSERT INTO notification.processed_event (event_id, event_type) VALUES ($1, 'LeaveDailyBalances') ON CONFLICT DO NOTHING`, [markId]);
        }
        return n;
      } finally {
        await qr.query(`SELECT pg_advisory_unlock(hashtext('leave-daily-balances'))`);
      }
    } finally {
      await qr.release();
    }
  }
}
