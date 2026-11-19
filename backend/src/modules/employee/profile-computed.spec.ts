import { onLeavePeriods, seniority } from './profile-computed';

describe('thông tin tự tính (FR-1.13)', () => {
  it('thâm niên và các mốc 5 năm (AC-1.13.2)', () => {
    expect(seniority('2016-03-01', '2026-11-14')).toEqual({
      hireDate: '2016-03-01',
      years: 10,
      months: 8,
      milestones: ['2021-03-01', '2026-03-01'],
      nextMilestone: '2031-03-01',
      annualLeaveBonus: 2,
    });
    expect(seniority('2026-07-01', '2026-11-14')).toMatchObject({ years: 0, months: 4, milestones: [], annualLeaveBonus: 0 });
    expect(seniority('2016-02-29', '2021-02-28').milestones).toEqual(['2021-02-28']);
  });

  it('khoảng tạm nghỉ (ON_LEAVE) từ các lần đổi trạng thái (AC-1.13.3)', () => {
    expect(
      onLeavePeriods([
        { at: '2025-03-01T00:00:00Z', from: 'ACTIVE', to: 'ON_LEAVE' },
        { at: '2025-09-01T00:00:00Z', from: 'ON_LEAVE', to: 'ACTIVE' },
        { at: '2026-10-01T00:00:00Z', from: 'ACTIVE', to: 'ON_LEAVE' },
      ]),
    ).toEqual([
      { from: '2025-03-01', to: '2025-09-01' },
      { from: '2026-10-01', to: null },
    ]);
  });
});
