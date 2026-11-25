/**
 * Event của luồng yêu cầu cập nhật hồ sơ (UC1 AC-1.9.4, 1.9.5, 1.9.10, 1.9.13). Payload không có giá trị hồ sơ; email chỉ là
 * thông báo chung (NFR-5.18), do notification service gửi.
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

// Nội dung email và quy tắc gộp email cho HR (tối đa một email mỗi giờ, AC-1.9.13) ở services/notification (ADR-15 bước 1).
