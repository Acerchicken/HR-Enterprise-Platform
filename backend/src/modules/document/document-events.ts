import { EntityManager } from 'typeorm';
import { writeOutbox } from '../../messaging/outbox';

/**
 * Event của kho tài liệu cho assistant service (UC5 spec 13.2, ADR-15, ADR-16). Ghi vào outbox chung `leave.outbox` trong
 * cùng giao dịch với thay đổi (như event của Identity, Employee), publisher đẩy với routing key `document.<Event>`.
 * Notification service không nghe `document.*` (D2: không gửi email cho tài liệu).
 *
 * Assistant service không đọc schema `document`, nên payload phải đủ để dựng lại phạm vi xem. Không có nội dung file,
 * tên người tải lên.
 */
export type DocumentEventType = 'DocumentPublished' | 'DocumentUpdated' | 'DocumentHidden' | 'DocumentRestored';

export const DOCUMENT_EVENT_TYPES: DocumentEventType[] = ['DocumentPublished', 'DocumentUpdated', 'DocumentHidden', 'DocumentRestored'];

export const isDocumentEvent = (t: string): t is DocumentEventType => (DOCUMENT_EVENT_TYPES as string[]).includes(t);

export interface DocumentScopePayload {
  all: boolean;
  departmentIds: string[];
  roles: string[];
}

export interface DocumentPublishedPayload {
  documentId: string;
  versionId: string;
  versionNo: number;
  objectKey: string;
  contentType: string;
  title: string;
  type: string;
  scope: DocumentScopePayload;
  hidden: boolean;
  occurredAt: string;
}

export interface DocumentUpdatedPayload {
  documentId: string;
  title: string;
  type: string;
  scope: DocumentScopePayload;
  occurredAt: string;
}

export interface DocumentVisibilityPayload {
  documentId: string;
  occurredAt: string;
}

export type DocumentEventPayload = DocumentPublishedPayload | DocumentUpdatedPayload | DocumentVisibilityPayload;

export async function writeDocumentEvent(m: EntityManager, type: DocumentEventType, payload: DocumentEventPayload): Promise<void> {
  await writeOutbox(m, type, payload.documentId, payload);
}
