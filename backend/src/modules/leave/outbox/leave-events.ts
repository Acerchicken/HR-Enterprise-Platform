/**
 * Event của luồng nghỉ phép (hàm thuần, dùng chung cho API ghi outbox và worker gửi email).
 * Payload chỉ có id và dữ liệu định tuyến; email chỉ là câu báo chung, không tên, loại phép, ngày, mã đơn (BR-15, UC4 13.2).
 */

export type LeaveEventType =
  | 'LeaveRequested'
  | 'LeaveApproved'
  | 'LeaveManagerApproved'
  | 'LeaveHrApproved'
  | 'LeaveRejected'
  | 'LeaveHrRejected'
  | 'LeaveCancelled'
  | 'LeaveCancelRequested'
  | 'LeaveCancelRequestRejected'
  | 'LeaveCompleted'
  | 'LeaveReminder'
  | 'LeaveRecalculated';

export const LEAVE_EVENT_TYPES: LeaveEventType[] = [
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
];

export const isLeaveEvent = (t: string): t is LeaveEventType => (LEAVE_EVENT_TYPES as string[]).includes(t);

/** Exchange và routing key trên RabbitMQ: leave.<event>, ví dụ leave.LeaveApproved. */
export const EVENTS_EXCHANGE = 'hr.events';
export const routingKey = (type: LeaveEventType) => `leave.${type}`;

export type CancelReason = 'OWNER' | 'CANCEL_REQUEST_APPROVED' | 'SYSTEM';

export interface LeaveEventPayload {
  requestId: string;
  employeeId: string;
  occurredAt: string;
  /** `LeaveRequested`: đơn do người khác tạo hộ (BR-12) thì báo thêm chủ đơn. */
  onBehalf?: boolean;
  /** `LeaveCancelled`. */
  reason?: CancelReason;
  /** Đơn đã qua hoặc cần HR (BR-16), hoặc của CEO: thêm nhóm HR vào người nhận. */
  hrInvolved?: boolean;
  /** `LeaveReminder`. */
  stage?: 'SUBMITTED' | 'PENDING_HR';
}

/** Nhóm người nhận; worker tra ra email. `APPROVERS`: quản lý trực tiếp hiện tại và người duyệt thay; CEO thì nhóm HR. */
export type Recipient = 'OWNER' | 'APPROVERS' | 'HR';

export function recipientsOf(type: LeaveEventType, p: LeaveEventPayload): Recipient[] {
  switch (type) {
    case 'LeaveRequested':
      return p.onBehalf ? ['APPROVERS', 'OWNER'] : ['APPROVERS'];
    case 'LeaveManagerApproved':
      return ['OWNER', 'HR'];
    case 'LeaveHrRejected':
      return ['OWNER', 'APPROVERS'];
    case 'LeaveCancelled': {
      const r: Recipient[] = p.reason === 'OWNER' ? ['APPROVERS'] : ['OWNER', 'APPROVERS'];
      return p.hrInvolved ? [...r, 'HR'] : r;
    }
    case 'LeaveCancelRequested':
      return p.hrInvolved ? ['HR'] : ['APPROVERS'];
    case 'LeaveReminder':
      return p.stage === 'PENDING_HR' ? ['HR'] : ['APPROVERS'];
    default:
      return ['OWNER'];
  }
}

const INBOX = 'Mở HRHelper, trang "Việc cần duyệt", tab "Đơn nghỉ" để xử lý.';
const MINE = 'Mở HRHelper, trang "Đơn nghỉ của tôi" để xem chi tiết.';

/** Email chung theo người nhận (BR-15): không có dữ liệu của đơn. */
export function buildEmail(type: LeaveEventType, to: Recipient): { subject: string; text: string } {
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
