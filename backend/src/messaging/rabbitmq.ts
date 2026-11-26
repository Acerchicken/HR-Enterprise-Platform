import { Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { EVENTS_EXCHANGE } from '../modules/leave/outbox/leave-events';
import { routingKeyOf } from './routing';
import { BusEvent, EventBus, EventConsumer, EventHandler } from './event-bus';

/** Queue của worker backend: chỉ event tài khoản, vai trò (identity-sync). Email do `services/notification` nghe `notification.leave`. */
export const QUEUE = 'identity.sync';
export const DEAD_LETTER_QUEUE = 'identity.sync.dlq';

/**
 * Publish lên exchange topic `hr.events` qua confirm channel: publish() chỉ resolve khi broker xác nhận.
 * Mất kết nối thì bỏ channel cũ, lần publish sau tự kết nối lại.
 */
export class RabbitMqEventBus implements EventBus {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.ConfirmChannel | null = null;

  constructor(private readonly url: string) {}

  async publish(event: BusEvent): Promise<void> {
    try {
      const channel = await this.ensureChannel();
      channel.publish(EVENTS_EXCHANGE, routingKeyOf(event.type), Buffer.from(JSON.stringify(event.payload)), {
        messageId: event.id,
        type: event.type,
        persistent: true,
        contentType: 'application/json',
        timestamp: Math.floor(event.createdAt.getTime() / 1000),
        ...(event.traceparent ? { headers: { traceparent: event.traceparent } } : {}),
      });
      await channel.waitForConfirms();
    } catch (e) {
      await this.close();
      throw e;
    }
  }

  async close(): Promise<void> {
    const c = this.connection;
    this.connection = null;
    this.channel = null;
    await c?.close().catch(() => undefined);
  }

  private async ensureChannel(): Promise<amqp.ConfirmChannel> {
    if (this.channel) return this.channel;
    const connection = await amqp.connect(this.url);
    connection.on('error', () => undefined);
    connection.on('close', () => {
      this.connection = null;
      this.channel = null;
    });
    const channel = await connection.createConfirmChannel();
    await channel.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
    this.connection = connection;
    this.channel = channel;
    return channel;
  }
}

/**
 * Nghe queue `identity.sync` (bind `identity.*`); handler lỗi thì nack không requeue → DLQ.
 * Message nằm trong queue durable nên worker kết nối lại vẫn nhận được event gửi lúc mất kết nối.
 */
export class RabbitMqEventConsumer implements EventConsumer {
  private readonly logger = new Logger(RabbitMqEventConsumer.name);
  private connection: amqp.ChannelModel | null = null;
  private closing = false;

  constructor(
    private readonly url: string,
    private readonly retryMs = 5000,
  ) {}

  /** Kết nối lần đầu phải thành công (lỗi thì process dừng); mất kết nối sau đó thì tự kết nối lại. */
  async start(handler: EventHandler): Promise<void> {
    this.closing = false;
    await this.connect(handler);
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
      this.logger.warn(`Mất kết nối RabbitMQ, thử lại sau ${this.retryMs / 1000} giây`);
      this.reconnect(handler);
    });
    this.connection = connection;
    const ch = await connection.createChannel();
    await ch.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
    await ch.assertQueue(DEAD_LETTER_QUEUE, { durable: true });
    await ch.assertQueue(QUEUE, { durable: true, deadLetterExchange: '', deadLetterRoutingKey: DEAD_LETTER_QUEUE });
    await ch.bindQueue(QUEUE, EVENTS_EXCHANGE, 'identity.*');
    await ch.prefetch(10);
    await ch.consume(QUEUE, (msg) => {
      if (!msg) return;
      const id = msg.properties.messageId as string;
      Promise.resolve()
        .then(() =>
          handler({
            id,
            type: msg.properties.type,
            payload: JSON.parse(msg.content.toString()),
            traceparent: (msg.properties.headers?.traceparent as string | undefined) ?? null,
          }),
        )
        .then(() => ch.ack(msg))
        .catch((e) => {
          this.logger.error(`Event ${id} lỗi, chuyển DLQ: ${e instanceof Error ? e.message : e}`);
          ch.nack(msg, false, false);
        });
    });
    this.logger.log(`Đang nghe hàng đợi RabbitMQ ${QUEUE}`);
  }

  private reconnect(handler: EventHandler) {
    setTimeout(() => {
      if (this.closing) return;
      this.connect(handler).catch((e) => {
        this.logger.warn(`Chưa kết nối lại được RabbitMQ: ${e instanceof Error ? e.message : e}`);
        this.reconnect(handler);
      });
    }, this.retryMs);
  }
}
