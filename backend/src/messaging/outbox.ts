import { EntityManager } from 'typeorm';
import { currentTraceparent } from '../tracing/tracing';

/**
 * Ghi một event vào `leave.outbox` trong giao dịch của nghiệp vụ (transactional outbox, ADR-03). Mọi module dùng hàm này
 * thay cho câu INSERT riêng, để event mang theo `trace_context` (W3C `traceparent` của request đang chạy, ADR-15 bước 4):
 * publisher nối span gửi đi vào đúng trace của request đã tạo event. Chưa bật tracing thì `trace_context` là NULL.
 */
export async function writeOutbox(m: EntityManager, type: string, aggregateId: string, payload: object): Promise<void> {
  await m.query(`INSERT INTO leave.outbox (event_type, aggregate_id, payload, trace_context) VALUES ($1, $2, $3, $4)`, [
    type,
    aggregateId,
    JSON.stringify(payload),
    currentTraceparent(),
  ]);
}
