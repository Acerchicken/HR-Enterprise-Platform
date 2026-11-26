import { LEAVE_EVENT_TYPES, leaveEmail, PROFILE_EVENT_TYPES, profileEmail } from './templates';

describe('nội dung email', () => {
  it('BR-15: email nghỉ phép không có mã đơn, ngày, loại phép, đường dẫn (AC-4.6.3)', () => {
    for (const type of LEAVE_EVENT_TYPES) {
      for (const to of ['OWNER', 'APPROVERS', 'HR'] as const) {
        const mail = leaveEmail(type, to);
        const all = `${mail.subject}\n${mail.text}`;
        expect(all).not.toMatch(/8f2c|\d{2}\/\d{2}|ANNUAL|SICK|ốm/);
        expect(all).not.toMatch(/https?:\/\//);
      }
    }
  });

  it('người duyệt nhận lời nhắc mở "Việc cần duyệt"; chủ đơn nhận lời nhắc mở "Đơn nghỉ của tôi"', () => {
    expect(leaveEmail('LeaveRequested', 'APPROVERS').text).toContain('Việc cần duyệt');
    expect(leaveEmail('LeaveApproved', 'OWNER').text).toContain('Đơn nghỉ của tôi');
  });

  it('NFR-5.18: email hồ sơ không có số tài khoản hay giá trị hồ sơ', () => {
    for (const type of PROFILE_EVENT_TYPES) expect(profileEmail(type).text).not.toMatch(/\d{6,}/);
  });
});
