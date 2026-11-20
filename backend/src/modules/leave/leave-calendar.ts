import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { TtlCache } from '../../common/ttl-cache';

/**
 * Lịch ngày lễ dùng chung cho tính số ngày (BR-03), tháng lẻ (BR-01), hoàn tất, nhắc đơn (UC4 13.5, 13.6). Cache theo năm;
 * HR sửa lịch thì xóa cache của process này, process khác (worker) hết hạn sau 5 phút.
 */
@Injectable()
export class LeaveCalendar {
  private readonly cache = new TtlCache<string[]>(5 * 60 * 1000);

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async holidays(fromYear: number, toYear = fromYear, m?: EntityManager): Promise<Set<string>> {
    const out = new Set<string>();
    for (let y = fromYear; y <= toYear; y++) {
      // Trong giao dịch đang khóa thì đọc thẳng để thấy dữ liệu mới nhất.
      const days = m ? await this.load(y, m) : await this.cache.getOrLoad(String(y), () => this.load(y));
      days.forEach((d) => out.add(d));
    }
    return out;
  }

  invalidate() {
    this.cache.clear();
  }

  private async load(year: number, m: EntityManager | DataSource = this.ds): Promise<string[]> {
    const rows: { d: string }[] = await m.query(
      `SELECT to_char(holiday_date, 'YYYY-MM-DD') AS d FROM leave.holiday WHERE holiday_date BETWEEN $1 AND $2`,
      [`${year}-01-01`, `${year}-12-31`],
    );
    return rows.map((r) => r.d);
  }
}
