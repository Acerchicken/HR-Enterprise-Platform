import { availableDays, isValidDate, leaveDays, LeavePeriod, overlaps } from './leave-rules';

const HOLIDAYS_2026 = new Set(['2026-04-26', '2026-04-27', '2026-04-30', '2026-05-01']);
const NONE = new Set<string>();
const full = (startDate: string, endDate: string): LeavePeriod => ({ startDate, endDate, halfDay: null });
const half = (date: string, halfDay: 'AM' | 'PM'): LeavePeriod => ({ startDate: date, endDate: date, halfDay });

describe('leave rules', () => {
  it('BR-03: đếm ngày làm việc, bỏ cuối tuần', () => {
    expect(leaveDays(full('2026-10-23', '2026-10-26'), NONE)).toBe(2); // T6 → T2
    expect(leaveDays(full('2026-10-24', '2026-10-25'), NONE)).toBe(0); // T7, CN
    expect(leaveDays(full('2026-10-26', '2026-10-30'), NONE)).toBe(5);
    expect(leaveDays(full('2026-10-30', '2026-10-26'), NONE)).toBe(0); // ngày kết thúc trước ngày bắt đầu
  });

  it('BR-03: bỏ ngày nghỉ lễ và ngày nghỉ bù', () => {
    expect(leaveDays(full('2026-04-29', '2026-05-04'), HOLIDAYS_2026)).toBe(2); // 29/4 và 4/5
    expect(leaveDays(full('2026-04-27', '2026-04-27'), HOLIDAYS_2026)).toBe(0); // nghỉ bù Giỗ Tổ
  });

  it('BR-04: nửa ngày tính 0,5; nửa ngày rơi vào ngày nghỉ tính 0', () => {
    expect(leaveDays(half('2026-10-26', 'AM'), NONE)).toBe(0.5);
    expect(leaveDays(half('2026-04-30', 'PM'), HOLIDAYS_2026)).toBe(0);
    expect(leaveDays({ startDate: '2026-10-26', endDate: '2026-10-27', halfDay: 'AM' }, NONE)).toBe(0);
  });

  it('ngày không có thật bị loại', () => {
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('2026-2-3')).toBe(false);
    expect(isValidDate('2026-02-28')).toBe(true);
    expect(leaveDays(full('2026-02-27', '2026-02-30'), NONE)).toBe(0);
  });

  it('BR-02: có chung một ngày là trùng', () => {
    expect(overlaps(full('2026-11-10', '2026-11-12'), full('2026-11-12', '2026-11-13'))).toBe(true);
    expect(overlaps(full('2026-11-10', '2026-11-12'), full('2026-11-13', '2026-11-14'))).toBe(false);
  });

  it('BR-04: hai nửa ngày khác buổi không trùng; cùng buổi hoặc cả ngày thì trùng', () => {
    expect(overlaps(half('2026-11-09', 'AM'), half('2026-11-09', 'PM'))).toBe(false);
    expect(overlaps(half('2026-11-09', 'AM'), half('2026-11-09', 'AM'))).toBe(true);
    expect(overlaps(half('2026-11-09', 'AM'), full('2026-11-09', '2026-11-09'))).toBe(true);
  });

  it('BR-01: số dư khả dụng', () => {
    expect(availableDays({ entitled: 12, used: 2, pending: 3 })).toBe(7);
  });
});
