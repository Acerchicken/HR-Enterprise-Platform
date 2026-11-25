import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { createTransport } from 'nodemailer';
import { AppConfig } from '../config/config';

export interface MailMessage {
  from: string;
  /** Một hoặc nhiều địa chỉ, cách nhau bằng dấu phẩy (như nodemailer). */
  to: string;
  subject: string;
  text: string;
}

/** Cổng gửi email của worker: `smtp` khi chạy local (Mailpit), `ses` trên AWS (staging-readiness F1). */
export interface MailSender {
  sendMail(msg: MailMessage): Promise<unknown>;
}

export function createMailSender(cfg: AppConfig): MailSender {
  if (cfg.mail.driver === 'ses') return new SesMailSender(new SESv2Client({ region: cfg.mail.sesRegion }));
  return createTransport({ host: cfg.smtp.host, port: cfg.smtp.port, secure: false });
}

const SES_BATCH = 49;

/**
 * Gửi qua Amazon SES (API v2, quyền `ses:SendEmail` của task worker). Người nhận đặt ở Bcc khi có nhiều người,
 * để email nhóm (BR-15) không lộ địa chỉ của nhau; một người thì đặt ở To.
 */
export class SesMailSender implements MailSender {
  constructor(private readonly client: Pick<SESv2Client, 'send'>) {}

  async sendMail(msg: MailMessage) {
    const to = msg.to.split(',').map((a) => a.trim()).filter(Boolean);
    // SES nhận tối đa 50 địa chỉ mỗi email (To + Bcc): chia lô 49 người + địa chỉ gửi ở To.
    for (let i = 0; i < to.length; i += SES_BATCH) {
      const batch = to.slice(i, i + SES_BATCH);
      const destination = to.length === 1 ? { ToAddresses: batch } : { ToAddresses: [msg.from], BccAddresses: batch };
      await this.client.send(
        new SendEmailCommand({
          FromEmailAddress: msg.from,
          Destination: destination,
          Content: {
            Simple: {
              Subject: { Data: msg.subject, Charset: 'UTF-8' },
              Body: { Text: { Data: msg.text, Charset: 'UTF-8' } },
            },
          },
        }),
      );
    }
  }
}
