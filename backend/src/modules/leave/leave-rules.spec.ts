import {
  allocateByYear,
  annualEntitlement,
  AnnualInput,
  availableDays,
  carryOver,
  ceil2,
  completableFrom,
  exceedsEventLimit,
  isValidDate,
  leaveDays,
  LeavePeriod,
  needsHrApproval,
  overlaps,
  reminderDueAt,
} from './leave-rules';

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

  it('BR-01: số dư khả dụng cộng phần chuyển từ năm trước', () => {
    expect(availableDays({ entitled: 12, carriedIn: 0, used: 2, pending: 3 })).toBe(7);
    expect(availableDays({ entitled: 12, carriedIn: 3, used: 0, pending: 0 })).toBe(15);
  });

  it('AC-3.1.8: chuyển phép chỉ phần của chính năm đó, không chuyển lần hai', () => {
    // 2026: được 12, dùng 9 → 2027 có 3.
    expect(carryOver({ entitled: 12, carriedIn: 0, used: 9, pending: 0 })).toBe(3);
    // 2027: chuyển sang 3, được 12, dùng 5 → 3 ngày chuyển sang trừ trước, 2 ngày của 2027 → 2028 có 10.
    expect(carryOver({ entitled: 12, carriedIn: 3, used: 5, pending: 0 })).toBe(10);
    // 2027 chỉ dùng 2: 1 ngày chuyển sang hết hạn → 2028 có 12.
    expect(carryOver({ entitled: 12, carriedIn: 3, used: 2, pending: 0 })).toBe(12);
    // Đơn đang chờ vẫn tính là đã giữ chỗ.
    expect(carryOver({ entitled: 12, carriedIn: 0, used: 9, pending: 2 })).toBe(1);
    expect(carryOver({ entitled: 12, carriedIn: 0, used: 12, pending: 1 })).toBe(0);
  });

  it('A5: đơn qua hai năm tách số ngày theo năm', () => {
    const h = new Set(['2027-01-01']);
    expect(allocateByYear(full('2026-12-29', '2027-01-04'), h)).toEqual([
      { year: 2026, days: 3 },
      { year: 2027, days: 1 },
    ]);
    expect(allocateByYear(full('2026-12-01', '2026-12-02'), h)).toEqual([{ year: 2026, days: 2 }]);
  });

  describe('BR-01, 13.2: phép năm', () => {
    const base: AnnualInput = { year: 2026, hireDate: '2020-01-01', terminationDate: null, baseDays: null, seniorityBonus: 0, holidays: NONE, unpaidDays: new Map() };
    it('làm cả năm: nền + thâm niên', () => {
      expect(annualEntitlement(base)).toBe(12);
      expect(annualEntitlement({ ...base, baseDays: 14, seniorityBonus: 2 })).toBe(16);
    });
    it('vào làm 01/7 được 6; 16/7 tháng 7 vẫn tính (12/23 ngày); 20/7 không tính (10/23)', () => {
      expect(annualEntitlement({ ...base, hireDate: '2026-07-01' })).toBe(6);
      expect(annualEntitlement({ ...base, hireDate: '2026-07-16' })).toBe(6);
      expect(annualEntitlement({ ...base, hireDate: '2026-07-20' })).toBe(5);
    });
    it('làm tròn lên 2 chữ số: 14/12×7 = 8,17; 13/12×1 = 1,09', () => {
      expect(annualEntitlement({ ...base, hireDate: '2026-06-01', baseDays: 14 })).toBe(8.17);
      expect(annualEntitlement({ ...base, hireDate: '2026-12-01', seniorityBonus: 1 })).toBe(1.09);
      expect(ceil2(1.0833333)).toBe(1.09);
      expect(ceil2(6)).toBe(6);
    });
    it('nghỉ việc giữa năm tính tới tháng nghỉ', () => {
      expect(annualEntitlement({ ...base, terminationDate: '2026-03-31' })).toBe(3);
    });
    it('đề xuất (a): ngày không lương đã duyệt trừ khỏi tháng', () => {
      const unpaid = new Map<string, number>();
      for (let d = 5; d <= 30; d++) unpaid.set(`2026-10-${String(d).padStart(2, '0')}`, 1);
      expect(annualEntitlement({ ...base, unpaidDays: unpaid })).toBe(11);
    });
  });

  it('AC-3.1.4: vượt mức theo sự kiện', () => {
    expect(exceedsEventLimit({ maxDaysPerEvent: 3, maxMonthsPerEvent: null }, full('2026-12-01', '2026-12-04'), 4)).toBe(true);
    expect(exceedsEventLimit({ maxDaysPerEvent: 3, maxMonthsPerEvent: null }, full('2026-12-01', '2026-12-03'), 3)).toBe(false);
    expect(exceedsEventLimit({ maxDaysPerEvent: null, maxMonthsPerEvent: 6 }, full('2026-03-15', '2026-09-14'), 130)).toBe(false);
    expect(exceedsEventLimit({ maxDaysPerEvent: null, maxMonthsPerEvent: 6 }, full('2026-03-15', '2026-09-15'), 130)).toBe(true);
  });

  it('BR-16: chụp cấu hình HR duyệt thêm; đơn của CEO không có bước HR', () => {
    expect(needsHrApproval({ hrApproval: 'OVER_DAYS', hrApprovalMinDays: 3 }, 5, false)).toBe(true);
    expect(needsHrApproval({ hrApproval: 'OVER_DAYS', hrApprovalMinDays: 3 }, 3, false)).toBe(false);
    expect(needsHrApproval({ hrApproval: 'ALWAYS', hrApprovalMinDays: null }, 1, false)).toBe(true);
    expect(needsHrApproval({ hrApproval: 'ALWAYS', hrApprovalMinDays: null }, 1, true)).toBe(false);
  });

  it('BR-10: hoàn tất từ ngày kế tiếp endDate', () => {
    expect(completableFrom('2026-12-31')).toBe('2027-01-01');
  });

  it('BR-17: nhắc 08:00 ngày làm việc thứ hai sau ngày vào giai đoạn chờ', () => {
    // Thứ Sáu 16:00 → thứ Hai là ngày đầy đủ → nhắc 08:00 thứ Ba.
    expect(reminderDueAt(new Date('2026-11-20T09:00:00Z'), NONE).toISOString()).toBe('2026-11-24T01:00:00.000Z');
    // Thứ Tư 28/4/2026: 29/4 đầy đủ; 30/4, 1/5 lễ; 2–3/5 cuối tuần → thứ Hai 4/5.
    expect(reminderDueAt(new Date('2026-04-28T03:00:00Z'), HOLIDAYS_2026).toISOString()).toBe('2026-05-04T01:00:00.000Z');
  });
});
