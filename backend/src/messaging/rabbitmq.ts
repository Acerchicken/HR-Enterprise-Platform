import { Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { EVENTS_EXCHANGE, LeaveEventType, routingKey } from '../modules/leave/outbox/leave-events';
import { BusEvent, EventBus, EventConsumer, EventHandler } from './event-bus';

export const QUEUE = 'notification.leave';
export const DEAD_LETTER_QUEUE = 'notification.leave.dlq';

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
      channel.publish(EVENTS_EXCHANGE, routingKey(event.type as LeaveEventType), Buffer.from(JSON.stringify(event.payload)), {
        messageId: event.id,
        type: event.type,
        persistent: true,
        contentType: 'application/json',
        timestamp: Math.floor(event.createdAt.getTime() / 1000),
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

/** Nghe queue `notification.leave` (bind `leave.*`); handler lỗi thì nack không requeue → DLQ. */
export class RabbitMqEventConsumer implements EventConsumer {
  private readonly logger = new Logger(RabbitMqEventConsumer.name);
  private connection: amqp.ChannelModel | null = null;

  constructor(private readonly url: string) {}

  async start(handler: EventHandler): Promise<void> {
    this.connection = await amqp.connect(this.url);
    const ch = await this.connection.createChannel();
    await ch.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
    await ch.assertQueue(DEAD_LETTER_QUEUE, { durable: true });
    await ch.assertQueue(QUEUE, { durable: true, deadLetterExchange: '', deadLetterRoutingKey: DEAD_LETTER_QUEUE });
    await ch.bindQueue(QUEUE, EVENTS_EXCHANGE, 'leave.*');
    await ch.prefetch(10);
    await ch.consume(QUEUE, (msg) => {
      if (!msg) return;
      const id = msg.properties.messageId as string;
      Promise.resolve()
        .then(() => handler({ id, type: msg.properties.type, payload: JSON.parse(msg.content.toString()) }))
        .then(() => ch.ack(msg))
        .catch((e) => {
          this.logger.error(`Event ${id} lỗi, chuyển DLQ: ${e instanceof Error ? e.message : e}`);
          ch.nack(msg, false, false);
        });
    });
    this.logger.log(`Đang nghe hàng đợi RabbitMQ ${QUEUE}`);
  }

  async close(): Promise<void> {
    await this.connection?.close().catch(() => undefined);
    this.connection = null;
  }
}
