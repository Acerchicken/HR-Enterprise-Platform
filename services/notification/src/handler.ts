import { IncomingEvent } from './messaging/consumer';
import { MailSender } from './mail/sender';
import { log } from './log';
import { isLeaveEvent, isProfileEvent, leaveEmail, Mail, profileEmail, Recipient } from './templates';

/** Chỉ cần `query` của `pg.Pool` (dễ thay bằng bản giả trong test). */
export interface Db {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[]; rowCount?: number | null }>;
}

/** Danh sách người nhận API gắn sẵn vào event (ADR-15 bước 1, event-carried state transfer). */
export interface MailGroup {
  group: Recipient;
  to: string[];
}

const RECIPIENTS: readonly string[] = ['OWNER', 'APPROVERS', 'HR'];
const DIGEST_TYPE = 'ProfileHrDigest';

export type HandleResult = 'sent' | 'duplicate';

/**
 * Xử lý một event: gửi email theo từng nhóm trong `payload.mail`, chống trùng bằng `notification.processed_event`.
 * - Đánh dấu từng nhóm đã gửi (`<eventId>#<nhóm>`): lỗi giữa chừng rồi queue giao lại thì không gửi lại nhóm đã nhận.
 * - Đánh dấu cả event sau khi gửi xong mọi nhóm; gặp lại id đã xử lý thì bỏ qua.
 * - Lỗi (sau khi đã thử lại, NFR-3.5) thì ném ra để consumer chuyển event vào DLQ.
 * Service không đọc schema khác ngoài `notification` (user `notification_svc`): người nhận lấy từ event, không tra cứu.
 */
export class NotificationHandler {
  constructor(
    private readonly db: Db,
    private readonly mailer: MailSender,
    private readonly hrDigestMinutes: number,
  ) {}

  async handle(e: IncomingEvent): Promise<HandleResult> {
    const leave = isLeaveEvent(e.type);
    if (!leave && !isProfileEvent(e.type)) {
      // Queue `notification.leave` chỉ nhận event nghỉ phép, hồ sơ. Loại khác (ví dụ event tài khoản phát trước khi tách routing
      // key `identity.*`) thì chuyển DLQ để đẩy sang đúng queue, không bỏ mất.
      throw new Error(`Event ${e.type} không thuộc notification service`);
    }
    if (!e.id) throw new Error('Event thiếu id, không chống trùng được');
    if (await this.processed(e.id)) {
      log.info('Bỏ qua event trùng', { eventId: e.id, type: e.type });
      return 'duplicate';
    }

    let recipients = 0;
    for (const { group, to } of mailGroupsOf(e.payload)) {
      const key = `${e.id}#${group}`;
      if (await this.processed(key)) continue;
      const mail: Mail = leave ? leaveEmail(e.type as never, group) : profileEmail(e.type as never);
      if (e.type === 'ProfileChangeSubmitted' && group === 'HR') {
        // AC-1.9.13: HR nhận tối đa một email báo chung trong mỗi khoảng `hrDigestMinutes`.
        if (await this.sendHrDigest(e.id, to, mail)) recipients += to.length;
      } else {
        await this.mailer.send({ to, ...mail });
        recipients += to.length;
      }
      await this.mark(key, e.type);
    }
    await this.mark(e.id, e.type);
    // Log không ghi địa chỉ email (NFR-8.1): chỉ loại event và số người nhận.
    log.info('Đã xử lý event', { eventId: e.id, type: e.type, recipients });
    return 'sent';
  }

  /**
   * Giữ chỗ bằng một dòng `ProfileHrDigest` trước khi gửi: hai event đến cùng lúc thì chỉ một event chèn được dòng (khóa theo
   * khoảng thời gian), event kia bỏ qua. Gửi lỗi thì xóa dòng giữ chỗ để lần giao lại gửi được.
   */
  private async sendHrDigest(eventId: string, to: string[], mail: Mail): Promise<boolean> {
    const recent = await this.db.query(
      `SELECT 1 FROM notification.processed_event WHERE event_type = $1 AND processed_at > now() - make_interval(mins => $2) LIMIT 1`,
      [DIGEST_TYPE, this.hrDigestMinutes],
    );
    if (recent.rows.length) return false;
    const slot = `profile-digest-${Math.floor(Date.now() / (this.hrDigestMinutes * 60_000))}`;
    const claimed = await this.db.query(
      `INSERT INTO notification.processed_event (event_id, event_type) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING event_id`,
      [slot, DIGEST_TYPE],
    );
    if (!claimed.rows.length) return false;
    try {
      await this.mailer.send({ to, ...mail });
    } catch (err) {
      await this.db.query(`DELETE FROM notification.processed_event WHERE event_id = $1`, [slot]).catch(() => undefined);
      throw err;
    }
    log.info('Đã gửi email gộp cho HR', { eventId, recipients: to.length });
    return true;
  }

  private async processed(id: string): Promise<boolean> {
    const r = await this.db.query('SELECT 1 FROM notification.processed_event WHERE event_id = $1', [id]);
    return r.rows.length > 0;
  }

  private async mark(id: string, type: string) {
    await this.db.query('INSERT INTO notification.processed_event (event_id, event_type) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, type]);
  }
}

/**
 * Đọc `payload.mail`. Event không có danh sách người nhận (phát bởi bản API cũ, trước ADR-15 bước 1) thì báo lỗi để event vào DLQ
 * và được xem lại, không lặng lẽ bỏ email.
 */
export function mailGroupsOf(payload: unknown): MailGroup[] {
  const mail = (payload as { mail?: unknown } | null)?.mail;
  if (!Array.isArray(mail)) throw new Error('Event thiếu danh sách người nhận (payload.mail)');
  return mail.map((g, i) => {
    const group = (g as MailGroup)?.group;
    const to = (g as MailGroup)?.to;
    if (!RECIPIENTS.includes(group) || !Array.isArray(to) || !to.every((a) => typeof a === 'string' && a.includes('@'))) {
      throw new Error(`payload.mail[${i}] không hợp lệ`);
    }
    return { group, to: [...new Set(to)] };
  }).filter((g) => g.to.length > 0);
}
