import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { LeaveJobsService } from '../modules/leave/leave-jobs.service';

/**
 * Mỗi 5 phút: hủy đơn của người đã nghỉ việc (AC-3.1.7), nhắc đơn chờ (BR-17), và một lần mỗi ngày tính lại số dư phép năm
 * (UC3 13.2). Worker khởi động lại không bỏ sót; nhiều worker chạy cùng lúc không làm trùng (khóa trong LeaveJobsService).
 */
export const LEAVE_JOB_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class LeaveJob implements OnApplicationShutdown {
  private readonly logger = new Logger(LeaveJob.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly jobs: LeaveJobsService) {}

  start() {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), LEAVE_JOB_INTERVAL_MS);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const cancelled = await this.jobs.cancelForTerminated();
      if (cancelled) this.logger.log(`Hủy ${cancelled} đơn của người nghỉ việc`);
      const reminded = await this.jobs.sendReminders();
      if (reminded) this.logger.log(`Nhắc ${reminded} đơn chờ`);
      const recalculated = await this.jobs.dailyBalances();
      if (recalculated !== null) this.logger.log(`Tính lại số dư phép năm của ${recalculated} người`);
    } catch (e) {
      this.logger.error(`Job nghỉ phép lỗi: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }
}
