import { auditPeriod, isAuditDate } from './audit-period';

describe('khoảng thời gian tra cứu audit (UC7 AC-7.3.5)', () => {
  it('from=to=ngày: từ 00:00 đến hết ngày theo giờ Việt Nam', () => {
    const p = auditPeriod('2026-11-01', '2026-11-01');
    expect(p.from?.toISOString()).toBe('2026-10-31T17:00:00.000Z');
    expect(p.toExclusive?.toISOString()).toBe('2026-11-01T17:00:00.000Z');
  });

  it('01:00 và 23:59 giờ Việt Nam ngày 1/11 nằm trong khoảng; 00:00 ngày 2/11 thì không', () => {
    const p = auditPeriod('2026-11-01', '2026-11-01');
    const inside = (iso: string) => new Date(iso) >= p.from! && new Date(iso) < p.toExclusive!;
    expect(inside('2026-11-01T01:00:00+07:00')).toBe(true);
    expect(inside('2026-11-01T23:59:59+07:00')).toBe(true);
    expect(inside('2026-11-02T00:00:00+07:00')).toBe(false);
    expect(inside('2026-10-31T23:59:59+07:00')).toBe(false);
  });

  it('ngày giờ ISO: dùng đúng mốc, `to` tính cả mốc', () => {
    const p = auditPeriod('2026-11-01T08:00:00+07:00', '2026-11-01T09:00:00Z');
    expect(p.from?.toISOString()).toBe('2026-11-01T01:00:00.000Z');
    expect(p.toExclusive?.toISOString()).toBe('2026-11-01T09:00:00.001Z');
  });

  it('không có mốc nào thì không lọc', () => {
    expect(auditPeriod()).toEqual({});
  });

  it.each(['2026-11-01', '2026-11-01T10:00:00Z', '2026-11-01T10:00:00+07:00'])('hợp lệ: %s', (v) => {
    expect(isAuditDate(v)).toBe(true);
  });

  it.each(['01/11/2026', '2026-13-01', '2026-02-30', 'abc', '2026-11-01T99:00'])('sai định dạng: %s', (v) => {
    expect(isAuditDate(v)).toBe(false);
  });
});
