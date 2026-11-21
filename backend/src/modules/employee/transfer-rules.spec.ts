import { addDays, vnToday } from './transfer-rules';

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
