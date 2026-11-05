/**
 * Event của luồng nghỉ phép (hàm thuần, dùng chung cho API ghi outbox và worker gửi email).
 */
import { HalfDay } from '../leave-rules';
import { LeaveAction } from '../leave-state-machine';

export type LeaveEventType = 'LeaveRequested' | 'LeaveApproved' | 'LeaveRejected' | 'LeaveCancelled' | 'LeaveCompleted';

export const EVENT_OF_ACTION: Record<LeaveAction, LeaveEventType> = {
  approve: 'LeaveApproved',
  reject: 'LeaveRejected',
  cancel: 'LeaveCancelled',
  complete: 'LeaveCompleted',
};

/** Exchange và routing key trên RabbitMQ: leave.<event>, ví dụ leave.LeaveApproved. */
export const EVENTS_EXCHANGE = 'hr.events';
export const routingKey = (type: LeaveEventType) => `leave.${type}`;

export interface LeaveEventPayload {
  requestId: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  halfDay: HalfDay | null;
  days: number;
  actorId: string;
  comment: string | null;
  occurredAt: string;
}

/** Ai nhận email: đơn mới và đơn bị hủy báo cho quản lý; quyết định và hoàn tất báo cho nhân viên. */
export function recipientOf(type: LeaveEventType): 'MANAGER' | 'EMPLOYEE' {
  return type === 'LeaveRequested' || type === 'LeaveCancelled' ? 'MANAGER' : 'EMPLOYEE';
}

const TITLE: Record<LeaveEventType, string> = {
  LeaveRequested: 'Đơn nghỉ phép mới chờ duyệt',
  LeaveApproved: 'Đơn nghỉ phép đã được duyệt',
  LeaveRejected: 'Đơn nghỉ phép bị từ chối',
  LeaveCancelled: 'Đơn nghỉ phép đã bị hủy',
  LeaveCompleted: 'Đơn nghỉ phép đã được HR hoàn tất',
};

const vnDate = (d: string) => d.split('-').reverse().join('/');

export function buildEmail(type: LeaveEventType, p: LeaveEventPayload, employeeName: string): { subject: string; text: string } {
  const period =
    p.startDate === p.endDate
      ? `${vnDate(p.startDate)}${p.halfDay ? (p.halfDay === 'AM' ? ' (buổi sáng)' : ' (buổi chiều)') : ''}`
      : `${vnDate(p.startDate)} – ${vnDate(p.endDate)}`;
  const lines = [
    `${TITLE[type]}.`,
    '',
    `Nhân viên: ${employeeName}`,
    `Loại phép: ${p.leaveType}`,
    `Thời gian: ${period} (${p.days} ngày)`,
  ];
  if (p.comment) lines.push(`Ghi chú: ${p.comment}`);
  lines.push('', `Mã đơn: ${p.requestId}`);
  return { subject: `[HR] ${TITLE[type]} – ${employeeName}, ${period}`, text: lines.join('\n') };
}
