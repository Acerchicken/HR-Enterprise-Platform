import * as amqp from 'amqplib';
import { DeleteMessageCommand, Message, ReceiveMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { AssistantConfig } from '../config';
import { errorText, log } from '../log';

/**
 * Nhận event tài liệu (`document.*`, UC5 spec 13.2). Queue giao ít nhất một lần: handler phải chịu được event trùng
 * (chống trùng bằng `assistant.processed_event`). Handler ném lỗi thì event vào DLQ (RabbitMQ: ngay; SQS: sau
 * maxReceiveCount lần), không lặp vô hạn.
 */
export interface IncomingEvent {
  id: string;
  type: string;
  payload: unknown;
}
export type EventHandler = (event: IncomingEvent) => Promise<void>;

export interface EventConsumer {
  start(handler: EventHandler): Promise<void>;
  close(): Promise<void>;
}

export const EXCHANGE = 'hr.events';
export const QUEUE = 'assistant.document';
export const DEAD_LETTER_QUEUE = 'assistant.document.dlq';

export function createConsumer(cfg: AssistantConfig['queue']): EventConsumer {
  if (cfg.driver === 'sqs') return new SqsConsumer(new SQSClient({ region: cfg.awsRegion }), cfg.sqsQueueUrl!);
  return new RabbitMqConsumer(cfg.rabbitmqUrl!);
}

/** Queue `assistant.document` bind `document.*` trên exchange topic `hr.events`; mất kết nối thì tự kết nối lại. */
export class RabbitMqConsumer implements EventConsumer {
  private connection: amqp.ChannelModel | null = null;
  private closing = false;

  constructor(
    private readonly url: string,
    private readonly retryMs = 5000,
  ) {}

  /**
   * Kết nối lần đầu, thử lại tới `startAttempts` lần: lúc docker compose khởi động, healthcheck của RabbitMQ có thể đạt trước
   * khi cổng AMQP nhận kết nối.
   */
  async start(handler: EventHandler, startAttempts = 12): Promise<void> {
    this.closing = false;
    for (let attempt = 1; ; attempt++) {
      try {
        await this.connect(handler);
        return;
      } catch (e) {
        if (attempt >= startAttempts || this.closing) throw e;
        log.warn('Chưa kết nối được RabbitMQ, thử lại', { attempt, retryMs: this.retryMs, error: errorText(e) });
        await new Promise((r) => setTimeout(r, this.retryMs));
      }
    }
  }

  async close(): Promise<void> {
    this.closing = true;
    await this.connection?.close().catch(() => undefined);
    this.connection = null;
  }

  private async connect(handler: EventHandler) {
    const connection = await amqp.connect(this.url);
    connection.on('error', () => undefined);
    connection.on('close', () => {
      this.connection = null;
      if (this.closing) return;
      log.warn('Mất kết nối RabbitMQ, thử lại', { retryMs: this.retryMs });
      this.reconnect(handler);
    });
    this.connection = connection;
    const ch = await connection.createChannel();
    await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
    await ch.assertQueue(DEAD_LETTER_QUEUE, { durable: true });
    await ch.assertQueue(QUEUE, { durable: true, deadLetterExchange: '', deadLetterRoutingKey: DEAD_LETTER_QUEUE });
    await ch.bindQueue(QUEUE, EXCHANGE, 'document.*');
    // Ingest tốn CPU (trích văn bản, embedding): xử lý từng event một.
    await ch.prefetch(1);
    await ch.consume(QUEUE, (msg) => {
      if (!msg) return;
      const id = String(msg.properties.messageId ?? '');
      Promise.resolve()
        .then(() => handler({ id, type: String(msg.properties.type ?? ''), payload: JSON.parse(msg.content.toString()) }))
        .then(() => ch.ack(msg))
        .catch((e) => {
          log.error('Event lỗi, chuyển DLQ', { eventId: id, error: errorText(e) });
          ch.nack(msg, false, false);
        });
    });
    log.info('Đang nghe hàng đợi RabbitMQ', { queue: QUEUE });
  }

  private reconnect(handler: EventHandler) {
    setTimeout(() => {
      if (this.closing) return;
      this.connect(handler).catch((e) => {
        log.warn('Chưa kết nối lại được RabbitMQ', { error: errorText(e) });
        this.reconnect(handler);
      });
    }, this.retryMs);
  }
}

/** Long polling SQS; xử lý xong mới xóa message. */
export class SqsConsumer implements EventConsumer {
  private stopped = false;
  private loop: Promise<void> | null = null;

  constructor(
    private readonly client: Pick<SQSClient, 'send' | 'destroy'>,
    private readonly queueUrl: string,
    private readonly waitSeconds = 20,
  ) {}

  async start(handler: EventHandler): Promise<void> {
    this.stopped = false;
    this.loop = this.run(handler);
    log.info('Đang nghe hàng đợi SQS', { queue: this.queueUrl });
  }

  async pollOnce(handler: EventHandler): Promise<number> {
    const res = await this.client.send(
      new ReceiveMessageCommand({ QueueUrl: this.queueUrl, MaxNumberOfMessages: 1, WaitTimeSeconds: this.waitSeconds, MessageAttributeNames: ['All'] }),
    );
    let ok = 0;
    for (const msg of res.Messages ?? []) if (await this.handleOne(msg, handler)) ok++;
    return ok;
  }

  async close(): Promise<void> {
    this.stopped = true;
    await this.loop?.catch(() => undefined);
    this.client.destroy();
  }

  private async run(handler: EventHandler) {
    while (!this.stopped) {
      try {
        await this.pollOnce(handler);
      } catch (e) {
        log.warn('Không nhận được message từ SQS', { error: errorText(e) });
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  private async handleOne(msg: Message, handler: EventHandler): Promise<boolean> {
    const id = msg.MessageAttributes?.messageId?.StringValue ?? msg.MessageId ?? '';
    const type = msg.MessageAttributes?.type?.StringValue ?? '';
    try {
      await handler({ id, type, payload: JSON.parse(msg.Body ?? 'null') });
    } catch (e) {
      log.error('Event lỗi, để SQS thử lại', { eventId: id, error: errorText(e) });
      return false;
    }
    await this.client.send(new DeleteMessageCommand({ QueueUrl: this.queueUrl, ReceiptHandle: msg.ReceiptHandle }));
    return true;
  }
}
