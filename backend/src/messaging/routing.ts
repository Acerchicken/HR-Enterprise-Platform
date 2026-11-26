import { isDocumentEvent } from '../modules/document/document-events';
import { isIdentityEvent } from '../modules/identity/identity-events';

/**
 * Định tuyến event theo loại (ADR-15):
 *   - `assistant`: event tài liệu cho assistant service (UC6);
 *   - `identity`: event tài khoản, vai trò cho `identity-sync` trong worker của backend (UC8, đồng bộ sang IdP);
 *   - `notification`: event nghỉ phép, hồ sơ cho notification service (`services/notification`, gửi email).
 * RabbitMQ: routing key trên exchange topic `hr.events`; queue `notification.leave` bind `leave.*`, `identity.sync` bind
 * `identity.*`, `assistant.document` bind `document.*`. SQS (chưa có SNS fan-out): gửi thẳng vào queue của đích.
 */
export type EventDestination = 'notification' | 'assistant' | 'identity';

export const destinationOf = (type: string): EventDestination =>
  isDocumentEvent(type) ? 'assistant' : isIdentityEvent(type) ? 'identity' : 'notification';

const PREFIX: Record<EventDestination, string> = { assistant: 'document', identity: 'identity', notification: 'leave' };

export const routingKeyOf = (type: string): string => `${PREFIX[destinationOf(type)]}.${type}`;
