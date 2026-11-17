import { currentRow, overlaps, workdaysBetween } from './profile-change.service';

describe('quy tắc mục HR quản lý (FR-1.12) và quá hạn (AC-1.9.13)', () => {
  it('hai hợp đồng trùng khoảng ngày; không thời hạn trùng mọi hợp đồng sau ngày bắt đầu (E18)', () => {
    expect(overlaps({ startDate: '2025-01-01', endDate: '2025-12-31' }, { startDate: '2026-01-01', endDate: '2026-12-31' })).toBe(false);
    expect(overlaps({ startDate: '2025-01-01', endDate: '2026-01-01' }, { startDate: '2026-01-01' })).toBe(true);
    expect(overlaps({ startDate: '2027-01-01' }, { startDate: '2026-01-01', endDate: '2026-12-31' })).toBe(false);
  });

  it('mức lương đang hiệu lực là ngày hiệu lực muộn nhất không sau hôm nay (AC-1.12.3)', () => {
    const rows = [{ data: { effectiveDate: '2025-01-01' } }, { data: { effectiveDate: '2026-06-01' } }, { data: { effectiveDate: '2027-01-01' } }];
    expect(currentRow(rows, '2026-11-15')).toBe(rows[1]);
    expect(currentRow(rows, '2024-01-01')).toBeUndefined();
  });

  it('đếm ngày làm việc bỏ thứ Bảy, Chủ nhật', () => {
    // Thứ Sáu 13/11/2026 → thứ Ba 17/11/2026: thứ Hai, thứ Ba = 2 ngày.
    expect(workdaysBetween(new Date('2026-11-13T09:00:00Z'), new Date('2026-11-17T09:00:00Z'))).toBe(2);
  });
});
