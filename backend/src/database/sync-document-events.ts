/**
 * Lệnh đồng bộ lần đầu cho assistant service (UC5 spec 13.2, UC6 deploy bước 3): ghi `DocumentPublished` cho phiên bản
 * `READY` mới nhất của mọi tài liệu, rồi `DocumentHidden` cho tài liệu đang ẩn. Assistant service nhận qua queue và index.
 *   npm run assistant:sync                        (local)
 *   node dist/database/sync-document-events.js    (staging, chạy một lần trong container API)
 * Chạy lại an toàn: assistant service thay toàn bộ đoạn của tài liệu khi nhận lại cùng phiên bản. Cũng dùng khi index hỏng
 * hoặc đổi cách chia đoạn (ADR-16 mục 4).
 */
import dataSource from './data-source';
import { writeDocumentEvent } from '../modules/document/document-events';

async function main() {
  await dataSource.initialize();
  try {
    const counts = await dataSource.transaction(async (m) => {
      const docs: Array<{
        id: string;
        title: string;
        type: string;
        scope_all: boolean;
        hidden: boolean;
        version_id: string;
        version_no: number;
        object_key: string;
        content_type: string;
        departments: string[];
        roles: string[];
      }> = await m.query(`
        SELECT d.id, d.title, d.type, d.scope_all, d.hidden,
               v.id AS version_id, v.version_no, v.object_key, v.content_type,
               COALESCE(array_agg(s.value) FILTER (WHERE s.kind = 'DEPARTMENT'), '{}') AS departments,
               COALESCE(array_agg(s.value) FILTER (WHERE s.kind = 'ROLE'), '{}') AS roles
        FROM document.document d
        JOIN LATERAL (
          SELECT id, version_no, object_key, content_type FROM document.document_version
          WHERE document_id = d.id AND status = 'READY' ORDER BY version_no DESC LIMIT 1
        ) v ON true
        LEFT JOIN document.document_scope s ON s.document_id = d.id
        GROUP BY d.id, v.id, v.version_no, v.object_key, v.content_type
        ORDER BY d.created_at`);
      const now = new Date().toISOString();
      let hidden = 0;
      for (const d of docs) {
        await writeDocumentEvent(m, 'DocumentPublished', {
          documentId: d.id,
          versionId: d.version_id,
          versionNo: d.version_no,
          objectKey: d.object_key,
          contentType: d.content_type,
          title: d.title,
          type: d.type,
          scope: { all: d.scope_all, departmentIds: d.departments, roles: d.roles },
          hidden: d.hidden,
          occurredAt: now,
        });
        if (d.hidden) {
          await writeDocumentEvent(m, 'DocumentHidden', { documentId: d.id, occurredAt: now });
          hidden++;
        }
      }
      return { published: docs.length, hidden };
    });
    console.log(`Đã ghi ${counts.published} DocumentPublished, ${counts.hidden} DocumentHidden vào outbox.`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
