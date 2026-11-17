import { careerTimeline, onLeavePeriods, seniority } from './profile-computed';

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

  it('quá trình công tác dựng từ audit nhóm trường tổ chức, mới nhất trước (AC-1.13.1)', () => {
    const t = careerTimeline('2020-01-06', { departmentId: 'd2', positionId: 'p2', managerId: 'm2' }, [
      { at: '2023-05-10T03:00:00Z', changes: { positionId: { from: 'p1', to: 'p2' } } },
      { at: '2022-01-03T03:00:00Z', changes: { departmentId: { from: 'd1', to: 'd2' }, managerId: { from: 'm1', to: 'm2' } } },
    ]);
    expect(t).toEqual([
      { from: '2023-05-10', to: null, departmentId: 'd2', positionId: 'p2', managerId: 'm2', reason: 'Đổi chức danh' },
      { from: '2022-01-03', to: '2023-05-10', departmentId: 'd2', positionId: 'p1', managerId: 'm2', reason: 'Điều chuyển phòng ban, Đổi quản lý trực tiếp' },
      { from: '2020-01-06', to: '2022-01-03', departmentId: 'd1', positionId: 'p1', managerId: 'm1', reason: 'Vào làm' },
    ]);
    expect(careerTimeline('2020-01-06', { departmentId: 'd', positionId: 'p', managerId: null }, [])).toHaveLength(1);
    // Đổi rồi đổi lại trong ngày: không thêm giai đoạn.
    const back = careerTimeline('2020-01-06', { departmentId: 'd', positionId: 'p1', managerId: null }, [
      { at: '2026-11-15T01:00:00Z', changes: { positionId: { from: 'p1', to: 'p2' } } },
      { at: '2026-11-15T02:00:00Z', changes: { positionId: { from: 'p2', to: 'p1' } } },
    ]);
    expect(back).toEqual([{ from: '2020-01-06', to: null, departmentId: 'd', positionId: 'p1', managerId: null, reason: 'Vào làm' }]);
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
