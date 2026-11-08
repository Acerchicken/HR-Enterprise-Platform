import { Logger } from '@nestjs/common';
import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { BusEvent, EventBus, EventConsumer, EventHandler } from './event-bus';

/** Gửi event vào SQS. Queue FIFO (URL đuôi .fifo) thì dùng id outbox làm MessageDeduplicationId. */
export class SqsEventBus implements EventBus {
  private readonly fifo: boolean;

  constructor(
    private readonly client: Pick<SQSClient, 'send' | 'destroy'>,
    private readonly queueUrl: string,
  ) {
    this.fifo = queueUrl.endsWith('.fifo');
  }

  async publish(event: BusEvent): Promise<void> {
    await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(event.payload),
        MessageAttributes: {
          messageId: { DataType: 'String', StringValue: event.id },
          type: { DataType: 'String', StringValue: event.type },
          createdAt: { DataType: 'String', StringValue: event.createdAt.toISOString() },
        },
        ...(this.fifo ? { MessageGroupId: 'leave', MessageDeduplicationId: event.id } : {}),
      }),
    );
  }

  async close(): Promise<void> {
    this.client.destroy();
  }
}

/**
 * Long polling SQS. Xử lý xong thì xóa message; handler lỗi thì không xóa, message hiện lại sau visibility
 * timeout và SQS tự chuyển sang DLQ khi vượt maxReceiveCount (cấu hình trong Terraform).
 */
export class SqsEventConsumer implements EventConsumer {
  private readonly logger = new Logger(SqsEventConsumer.name);
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
    this.logger.log(`Đang nghe hàng đợi SQS ${this.queueUrl}`);
  }

  /** Một lượt nhận tối đa 10 message; trả về số message đã xử lý thành công (dùng cho test). */
  async pollOnce(handler: EventHandler): Promise<number> {
    const res = await this.client.send(
      new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: this.waitSeconds,
        MessageAttributeNames: ['All'],
      }),
    );
    let ok = 0;
    for (const msg of res.Messages ?? []) {
      if (await this.handleOne(msg, handler)) ok++;
    }
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
        this.logger.warn(`Không nhận được message từ SQS: ${e instanceof Error ? e.message : e}`);
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
      // Không xóa: SQS trả lại message sau visibility timeout, quá maxReceiveCount thì vào DLQ.
      this.logger.error(`Event ${id} lỗi, để SQS thử lại: ${e instanceof Error ? e.message : e}`);
      return false;
    }
    await this.client.send(new DeleteMessageCommand({ QueueUrl: this.queueUrl, ReceiptHandle: msg.ReceiptHandle }));
    return true;
  }
}
