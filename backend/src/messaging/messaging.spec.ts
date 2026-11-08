import { DeleteMessageCommand, ReceiveMessageCommand, SendMessageCommand } from '@aws-sdk/client-sqs';
import { loadConfig } from '../config/config';
import { createEventBus } from './factory';
import { RabbitMqEventBus } from './rabbitmq';
import { SqsEventBus, SqsEventConsumer } from './sqs';

jest.mock('amqplib', () => {
  const channel = {
    assertExchange: jest.fn(async () => ({})),
    publish: jest.fn(() => true),
    waitForConfirms: jest.fn(async () => undefined),
  };
  const connection = { on: jest.fn(), close: jest.fn(async () => undefined), createConfirmChannel: jest.fn(async () => channel) };
  return { connect: jest.fn(async () => connection), __channel: channel, __connection: connection };
});
// eslint-disable-next-line @typescript-eslint/no-var-requires
const amqpMock = require('amqplib');

const event = { id: 'evt-1', type: 'LeaveApproved', payload: { requestId: 'r-1' }, createdAt: new Date('2026-11-07T00:00:00Z') };

function fakeSqs(received: any[] = []) {
  const sent: any[] = [];
  return {
    sent,
    destroy: jest.fn(),
    send: jest.fn(async (cmd: any) => {
      sent.push(cmd);
      if (cmd instanceof ReceiveMessageCommand) return { Messages: received };
      return {};
    }),
  };
}

describe('QUEUE_DRIVER', () => {
  it('không cấu hình gì thì driver none và API không đẩy event', () => {
    const cfg = loadConfig({});
    expect(cfg.queue.driver).toBe('none');
    expect(createEventBus(cfg)).toBeNull();
  });

  it('có RABBITMQ_URL thì mặc định rabbitmq (giữ hành vi local cũ)', () => {
    const cfg = loadConfig({ RABBITMQ_URL: 'amqp://hr:hr@localhost:5672' });
    expect(cfg.queue.driver).toBe('rabbitmq');
    expect(createEventBus(cfg)).toBeInstanceOf(RabbitMqEventBus);
  });

  it('sqs cần SQS_QUEUE_URL và AWS_REGION', () => {
    expect(() => loadConfig({ QUEUE_DRIVER: 'sqs' })).toThrow(/SQS_QUEUE_URL/);
    const cfg = loadConfig({
      QUEUE_DRIVER: 'sqs',
      SQS_QUEUE_URL: 'https://sqs.ap-southeast-1.amazonaws.com/123/hr-worker',
      AWS_REGION: 'ap-southeast-1',
    });
    expect(createEventBus(cfg)).toBeInstanceOf(SqsEventBus);
  });

  it('giá trị lạ thì báo lỗi khi khởi động', () => {
    expect(() => loadConfig({ QUEUE_DRIVER: 'kafka' })).toThrow(/QUEUE_DRIVER/);
    expect(() => loadConfig({ QUEUE_DRIVER: 'rabbitmq' })).toThrow(/RABBITMQ_URL/);
  });
});

describe('RabbitMqEventBus', () => {
  it('publish lên hr.events với routing key leave.<event>, messageId = id outbox, chờ confirm', async () => {
    const bus = new RabbitMqEventBus('amqp://x');
    await bus.publish(event);
    const ch = amqpMock.__channel;
    expect(ch.publish).toHaveBeenCalledWith('hr.events', 'leave.LeaveApproved', expect.any(Buffer), expect.objectContaining({ messageId: 'evt-1', type: 'LeaveApproved', persistent: true }));
    expect(ch.waitForConfirms).toHaveBeenCalled();
  });

  it('broker không xác nhận thì throw và bỏ kết nối để lần sau kết nối lại', async () => {
    const bus = new RabbitMqEventBus('amqp://x');
    amqpMock.__channel.waitForConfirms.mockRejectedValueOnce(new Error('nack'));
    await expect(bus.publish(event)).rejects.toThrow('nack');
    expect(amqpMock.__connection.close).toHaveBeenCalled();
    amqpMock.connect.mockClear();
    await bus.publish(event);
    expect(amqpMock.connect).toHaveBeenCalledTimes(1);
  });
});

describe('SqsEventBus', () => {
  it('queue standard: gửi payload, id outbox và loại event trong message attribute', async () => {
    const sqs = fakeSqs();
    await new SqsEventBus(sqs as any, 'https://sqs/hr-worker').publish(event);
    const cmd = sqs.sent[0] as SendMessageCommand;
    expect(cmd).toBeInstanceOf(SendMessageCommand);
    expect(JSON.parse(cmd.input.MessageBody!)).toEqual({ requestId: 'r-1' });
    expect(cmd.input.MessageAttributes!.messageId.StringValue).toBe('evt-1');
    expect(cmd.input.MessageAttributes!.type.StringValue).toBe('LeaveApproved');
    expect(cmd.input.MessageDeduplicationId).toBeUndefined();
  });

  it('queue FIFO: id outbox làm MessageDeduplicationId', async () => {
    const sqs = fakeSqs();
    await new SqsEventBus(sqs as any, 'https://sqs/hr-worker.fifo').publish(event);
    expect(sqs.sent[0].input).toMatchObject({ MessageDeduplicationId: 'evt-1', MessageGroupId: 'leave' });
  });
});

describe('SqsEventConsumer', () => {
  const msg = (id: string) => ({
    MessageId: 'sqs-' + id,
    ReceiptHandle: 'rh-' + id,
    Body: JSON.stringify({ requestId: id }),
    MessageAttributes: { messageId: { DataType: 'String', StringValue: id }, type: { DataType: 'String', StringValue: 'LeaveRequested' } },
  });

  it('xử lý xong thì xóa message, handler nhận id outbox', async () => {
    const sqs = fakeSqs([msg('evt-1')]);
    const handler = jest.fn(async () => undefined);
    const ok = await new SqsEventConsumer(sqs as any, 'https://sqs/q', 0).pollOnce(handler);
    expect(ok).toBe(1);
    expect(handler).toHaveBeenCalledWith({ id: 'evt-1', type: 'LeaveRequested', payload: { requestId: 'evt-1' } });
    const del = sqs.sent.find((c) => c instanceof DeleteMessageCommand);
    expect(del?.input.ReceiptHandle).toBe('rh-evt-1');
  });

  it('handler lỗi thì không xóa để SQS thử lại rồi chuyển DLQ', async () => {
    const sqs = fakeSqs([msg('evt-1'), msg('evt-2')]);
    const handler = jest.fn(async (e: { id: string }) => {
      if (e.id === 'evt-1') throw new Error('smtp down');
    });
    const ok = await new SqsEventConsumer(sqs as any, 'https://sqs/q', 0).pollOnce(handler);
    expect(ok).toBe(1);
    const deleted = sqs.sent.filter((c) => c instanceof DeleteMessageCommand).map((c) => c.input.ReceiptHandle);
    expect(deleted).toEqual(['rh-evt-2']);
  });
});
