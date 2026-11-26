import { SQSClient } from '@aws-sdk/client-sqs';
import { AppConfig } from '../config/config';
import { EventBus, EventConsumer } from './event-bus';
import { RabbitMqEventBus, RabbitMqEventConsumer } from './rabbitmq';
import { SqsEventBus, SqsEventConsumer } from './sqs';

/** null = không cấu hình queue (vd khi chạy test): API vẫn ghi outbox nhưng không đẩy đi. */
export function createEventBus(cfg: AppConfig): EventBus | null {
  const q = cfg.queue;
  if (q.driver === 'sqs') return new SqsEventBus(new SQSClient({ region: q.awsRegion! }), q.sqsQueueUrl!, q.sqsAssistantQueueUrl, q.sqsIdentityQueueUrl);
  if (q.driver === 'rabbitmq') return new RabbitMqEventBus(q.rabbitmqUrl!);
  return null;
}

export function createEventConsumer(cfg: AppConfig): EventConsumer {
  const q = cfg.queue;
  if (q.driver === 'sqs') {
    if (!q.sqsIdentityQueueUrl) throw new Error('Worker với QUEUE_DRIVER=sqs cần SQS_IDENTITY_QUEUE_URL (queue event tài khoản, UC8)');
    return new SqsEventConsumer(new SQSClient({ region: q.awsRegion! }), q.sqsIdentityQueueUrl);
  }
  if (q.driver === 'rabbitmq') return new RabbitMqEventConsumer(q.rabbitmqUrl!);
  throw new Error('Worker cần QUEUE_DRIVER=rabbitmq (kèm RABBITMQ_URL) hoặc QUEUE_DRIVER=sqs (kèm SQS_QUEUE_URL)');
}
