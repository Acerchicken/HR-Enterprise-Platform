import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { TransferService } from '../modules/employee/transfer.service';

/** Mỗi 5 phút áp dụng điều chuyển tới ngày (UC2 AC-2.7.2, spec mục 13). Worker khởi động lại vẫn không bỏ sót. */
export const TRANSFER_JOB_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class TransferJob implements OnApplicationShutdown {
  private readonly logger = new Logger(TransferJob.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly transfers: TransferService) {}

  start() {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), TRANSFER_JOB_INTERVAL_MS);
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const r = await this.transfers.applyDue();
      if (r.applied || r.failed) this.logger.log(`Điều chuyển: áp dụng ${r.applied}, lỗi ${r.failed}`);
    } catch (e) {
      this.logger.error(`Job điều chuyển lỗi: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }
}
