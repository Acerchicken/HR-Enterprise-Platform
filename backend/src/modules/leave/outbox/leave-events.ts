/**
 * Event của luồng nghỉ phép (hàm thuần): API ghi outbox và tính nhóm người nhận (`recipientsOf`); notification service gửi email.
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

/** Nhóm người nhận; outbox publisher tra ra email (notification-recipients.ts). `APPROVERS`: quản lý trực tiếp hiện tại và người duyệt thay; CEO thì nhóm HR. */
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

// Nội dung email (câu báo chung theo nhóm người nhận, BR-15) nằm ở services/notification/src/templates.ts (ADR-15 bước 1).
