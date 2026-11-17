/**
 * Email của luồng yêu cầu cập nhật hồ sơ (UC1 AC-1.9.4, 1.9.5, 1.9.10, 1.9.13). Nội dung chỉ là thông báo chung, không chứa giá
 * trị hồ sơ, lý do từ chối hay số tài khoản (NFR-5.18); người nhận mở ứng dụng để xem chi tiết.
 */
export type ProfileEventType = 'ProfileChangeSubmitted' | 'ProfileChangeDecided' | 'BankAccountChanged';

export interface ProfileEventPayload {
  requestId: string;
  employeeId: string;
  section: string;
  status: string;
  occurredAt: string;
}

export const isProfileEvent = (type: string): type is ProfileEventType =>
  type === 'ProfileChangeSubmitted' || type === 'ProfileChangeDecided' || type === 'BankAccountChanged';

/** HR nhận tối đa một email báo có yêu cầu mới mỗi giờ (AC-1.9.13). */
export const HR_DIGEST_INTERVAL_MINUTES = 60;

export function buildProfileEmail(type: ProfileEventType): { subject: string; text: string } {
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
