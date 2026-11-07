/**
 * Lớp tách queue khỏi nghiệp vụ: outbox publisher chỉ biết EventBus, worker chỉ biết EventConsumer.
 * Driver chọn bằng QUEUE_DRIVER: `rabbitmq` khi chạy local (docker compose), `sqs` trên AWS.
 *
 * Cả hai driver giao "ít nhất một lần": event có thể tới worker hơn một lần, worker chống trùng theo `id`
 * (= id dòng leave.outbox) bằng bảng notification.processed_event.
 */
export interface BusEvent {
  /** Id dòng outbox, dùng làm khóa chống trùng ở worker. */
  id: string;
  /** Loại event, ví dụ LEAVE_SUBMITTED. */
  type: string;
  payload: unknown;
  createdAt: Date;
}

export interface EventBus {
  /** Chỉ resolve khi broker đã nhận event; lỗi thì throw để outbox giữ event lại cho lượt sau. */
  publish(event: BusEvent): Promise<void>;
  close(): Promise<void>;
}

/** Xử lý xong (resolve) thì event bị xóa khỏi queue; throw thì để driver đưa vào DLQ. */
export type EventHandler = (event: Omit<BusEvent, 'createdAt'>) => Promise<void>;

export interface EventConsumer {
  start(handler: EventHandler): Promise<void>;
  close(): Promise<void>;
}

export const EVENT_BUS = Symbol('EVENT_BUS');
