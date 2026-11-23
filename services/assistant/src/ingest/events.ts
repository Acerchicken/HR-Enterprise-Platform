/**
 * Hợp đồng event tài liệu (UC5 spec 13.2). Bản sao kiểu của `backend/src/modules/document/document-events.ts`:
 * service không import code của `backend/` (ADR-15), đổi hợp đồng thì sửa cả hai nơi và event-contract.md.
 */
export interface DocumentScope {
  all: boolean;
  departmentIds: string[];
  roles: string[];
}

export interface DocumentPublished {
  documentId: string;
  versionId: string;
  versionNo: number;
  objectKey: string;
  contentType: string;
  title: string;
  type: string;
  scope: DocumentScope;
  hidden: boolean;
  occurredAt: string;
}

export interface DocumentUpdated {
  documentId: string;
  title: string;
  type: string;
  scope: DocumentScope;
  occurredAt: string;
}

export interface DocumentVisibility {
  documentId: string;
  occurredAt: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Kiểm payload tối thiểu; sai thì ném lỗi để event vào DLQ, không ghi dữ liệu hỏng vào index. */
export function checkScope(s: unknown): DocumentScope {
  const scope = s as DocumentScope;
  if (!scope || typeof scope.all !== 'boolean' || !Array.isArray(scope.departmentIds) || !Array.isArray(scope.roles)) {
    throw new Error('Payload thiếu scope');
  }
  if (scope.departmentIds.some((d) => typeof d !== 'string' || !UUID.test(d))) throw new Error('scope.departmentIds không phải uuid');
  return { all: scope.all, departmentIds: scope.departmentIds, roles: scope.roles.map(String) };
}

export function checkDocumentId(p: unknown): string {
  const id = (p as { documentId?: unknown })?.documentId;
  if (typeof id !== 'string' || !UUID.test(id)) throw new Error('Payload thiếu documentId');
  return id;
}
