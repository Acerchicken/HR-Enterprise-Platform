import { isDocumentEvent } from '../modules/document/document-events';

/**
 * Định tuyến event theo loại (ADR-15): event tài liệu cho assistant service (UC6), còn lại cho notification service.
 * RabbitMQ: routing key trên exchange topic `hr.events`; queue `notification.leave` bind `leave.*`, queue
 * `assistant.document` bind `document.*`. SQS (chưa có SNS fan-out): gửi thẳng vào queue của đích.
 */
export type EventDestination = 'notification' | 'assistant';

export const destinationOf = (type: string): EventDestination => (isDocumentEvent(type) ? 'assistant' : 'notification');

export const routingKeyOf = (type: string): string => (destinationOf(type) === 'assistant' ? `document.${type}` : `leave.${type}`);
