import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { createTransport, Transporter } from 'nodemailer';
import { NotificationConfig } from '../config';
import { RetryOptions, withRetry } from './retry';

export interface MailMessage {
  to: string[];
  subject: string;
  text: string;
}

/** Cổng gửi email: `smtp` khi chạy local (Mailpit), `ses` trên AWS (staging-readiness F1). Mỗi lần gửi có thời gian chờ và thử lại (NFR-3.5). */
export interface MailSender {
  send(msg: MailMessage): Promise<void>;
}

export function createMailSender(cfg: NotificationConfig['mail']): MailSender {
  const retry: RetryOptions = { attempts: cfg.attempts, delayMs: cfg.retryDelayMs };
  if (cfg.driver === 'ses') {
    // Thử lại do service tự làm (giãn cách, log từng lần); tắt thử lại mặc định của SDK để tổng thời gian dễ đoán.
    const client = new SESv2Client({
      region: cfg.sesRegion,
      maxAttempts: 1,
      requestHandler: { connectionTimeout: cfg.timeoutMs, requestTimeout: cfg.timeoutMs },
    });
    return new SesMailSender(client, cfg.from, retry);
  }
  const transport = createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: false,
    connectionTimeout: cfg.timeoutMs,
    greetingTimeout: cfg.timeoutMs,
    socketTimeout: cfg.timeoutMs,
  });
  return new SmtpMailSender(transport, cfg.from, retry);
}

/** SMTP (Mailpit khi chạy local). Nhiều người nhận thì đặt ở Bcc như SES, để email nhóm (BR-15) không lộ địa chỉ của nhau. */
export class SmtpMailSender implements MailSender {
  constructor(
    private readonly transport: Pick<Transporter, 'sendMail'>,
    private readonly from: string,
    private readonly retry: RetryOptions,
  ) {}

  async send(msg: MailMessage) {
    if (!msg.to.length) return;
    const dest = msg.to.length === 1 ? { to: msg.to[0] } : { to: this.from, bcc: msg.to };
    await withRetry('smtp', () => this.transport.sendMail({ from: this.from, ...dest, subject: msg.subject, text: msg.text }), this.retry);
  }
}

const SES_BATCH = 49;

/**
 * Amazon SES (API v2, quyền `ses:SendEmail` của task notification). Một người nhận thì đặt ở To; nhiều người thì ở Bcc.
 * SES nhận tối đa 50 địa chỉ mỗi email (To + Bcc): chia lô 49 người + địa chỉ gửi ở To. Thử lại theo từng lô, lô đã gửi không gửi lại.
 */
export class SesMailSender implements MailSender {
  constructor(
    private readonly client: Pick<SESv2Client, 'send'>,
    private readonly from: string,
    private readonly retry: RetryOptions,
  ) {}

  async send(msg: MailMessage) {
    const to = msg.to.map((a) => a.trim()).filter(Boolean);
    for (let i = 0; i < to.length; i += SES_BATCH) {
      const batch = to.slice(i, i + SES_BATCH);
      const destination = to.length === 1 ? { ToAddresses: batch } : { ToAddresses: [this.from], BccAddresses: batch };
      const command = new SendEmailCommand({
        FromEmailAddress: this.from,
        Destination: destination,
        Content: {
          Simple: {
            Subject: { Data: msg.subject, Charset: 'UTF-8' },
            Body: { Text: { Data: msg.text, Charset: 'UTF-8' } },
          },
        },
      });
      await withRetry('ses', () => this.client.send(command), this.retry);
    }
  }
}
