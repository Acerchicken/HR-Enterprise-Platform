import { addDays, transferHorizon, vnToday } from './transfer-rules';

describe('ngày theo giờ Việt Nam (job điều chuyển)', () => {
  it('17:00 UTC đã là ngày hôm sau ở Việt Nam', () => {
    expect(vnToday(new Date('2026-11-30T16:59:00Z'))).toBe('2026-11-30');
    expect(vnToday(new Date('2026-11-30T17:00:00Z'))).toBe('2026-12-01');
  });

  it('cộng trừ ngày qua tháng, năm', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-12-18', -30)).toBe('2026-11-18');
  });
});

describe('transferHorizon (UC2 E18)', () => {
  it('cùng ngày lịch năm sau, tính cả mốc', () => {
    expect(transferHorizon('2026-11-25')).toBe('2027-11-25');
    expect(transferHorizon('2026-12-31')).toBe('2027-12-31');
  });
  it('29/2 thì lấy 28/2 năm sau', () => {
    expect(transferHorizon('2028-02-29')).toBe('2029-02-28');
  });
});
