/**
 * Nội dung email (chuyển từ backend sang đây ở ADR-15 bước 1). Chỉ là câu báo chung theo nhóm người nhận: không tên, loại phép,
 * ngày, mã đơn (BR-15, UC4 13.2), không giá trị hồ sơ hay số tài khoản (NFR-5.18). Người nhận mở HRHelper để xem chi tiết.
 */
export type Recipient = 'OWNER' | 'APPROVERS' | 'HR';

export const LEAVE_EVENT_TYPES = [
  'LeaveRequested',
  'LeaveApproved',
  'LeaveManagerApproved',
  'LeaveHrApproved',
  'LeaveRejected',
  'LeaveHrRejected',
  'LeaveCancelled',
  'LeaveCancelRequested',
  'LeaveCancelRequestRejected',
  'LeaveCompleted',
  'LeaveReminder',
  'LeaveRecalculated',
] as const;
export type LeaveEventType = (typeof LEAVE_EVENT_TYPES)[number];

export const PROFILE_EVENT_TYPES = ['ProfileChangeSubmitted', 'ProfileChangeDecided', 'BankAccountChanged'] as const;
export type ProfileEventType = (typeof PROFILE_EVENT_TYPES)[number];

export const isLeaveEvent = (t: string): t is LeaveEventType => (LEAVE_EVENT_TYPES as readonly string[]).includes(t);
export const isProfileEvent = (t: string): t is ProfileEventType => (PROFILE_EVENT_TYPES as readonly string[]).includes(t);

export interface Mail {
  subject: string;
  text: string;
}

const INBOX = 'Mở HRHelper, trang "Việc cần duyệt", tab "Đơn nghỉ" để xử lý.';
const MINE = 'Mở HRHelper, trang "Đơn nghỉ của tôi" để xem chi tiết.';

export function leaveEmail(type: LeaveEventType, to: Recipient): Mail {
  if (to !== 'OWNER') {
    if (type === 'LeaveReminder') {
      return { subject: '[HRHelper] Có đơn nghỉ chờ xử lý quá một ngày làm việc', text: `Bạn có đơn nghỉ đang chờ xử lý quá một ngày làm việc.\n\n${INBOX}` };
    }
    if (type === 'LeaveCancelled' || type === 'LeaveHrRejected') {
      return { subject: '[HRHelper] Một đơn nghỉ đã được cập nhật', text: `Một đơn nghỉ bạn liên quan vừa được cập nhật.\n\n${INBOX}` };
    }
    return { subject: '[HRHelper] Có yêu cầu nghỉ phép cần xử lý', text: `Có yêu cầu nghỉ phép cần bạn xử lý.\n\n${INBOX}` };
  }
  if (type === 'LeaveRequested') {
    return { subject: '[HRHelper] Có đơn nghỉ được tạo cho bạn', text: `Một đơn nghỉ vừa được tạo cho bạn.\n\n${MINE}` };
  }
  return { subject: '[HRHelper] Đơn nghỉ của bạn đã được cập nhật', text: `Đơn nghỉ của bạn vừa được cập nhật.\n\n${MINE}` };
}

export function profileEmail(type: ProfileEventType): Mail {
  switch (type) {
    case 'ProfileChangeSubmitted':
      return {
        subject: 'Có yêu cầu cập nhật hồ sơ cần xử lý',
        text: 'Có yêu cầu cập nhật hồ sơ nhân viên đang chờ HR xác nhận.\n\nMở HRHelper, trang "Việc cần duyệt", tab "Sửa hồ sơ" để xử lý.',
      };
    case 'ProfileChangeDecided':
      return {
        subject: 'Yêu cầu cập nhật hồ sơ của bạn đã được xử lý',
        text: 'Yêu cầu cập nhật hồ sơ của bạn đã được HR xử lý.\n\nMở HRHelper, mục "Hồ sơ của tôi" để xem kết quả.',
      };
    case 'BankAccountChanged':
      return {
        subject: 'Thông tin tài khoản ngân hàng trên HRHelper vừa thay đổi',
        text: 'Thông tin tài khoản ngân hàng nhận lương của bạn trên HRHelper vừa thay đổi.\n\nNếu không phải bạn yêu cầu, hãy báo HR ngay.',
      };
  }
}
