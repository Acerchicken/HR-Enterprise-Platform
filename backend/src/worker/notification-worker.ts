import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { APP_CONFIG, AppConfig } from '../config/config';
import { EmployeeService } from '../modules/employee/employee.service';
import { EventConsumer } from '../messaging/event-bus';
import { createEventConsumer } from '../messaging/factory';
import { buildEmail, LeaveEventPayload, LeaveEventType, Recipient, recipientsOf } from '../modules/leave/outbox/leave-events';
import {
  buildProfileEmail,
  HR_DIGEST_INTERVAL_MINUTES,
  isProfileEvent,
  ProfileEventPayload,
  ProfileEventType,
} from '../modules/employee/profile-events';
import { isIdentityEvent } from '../modules/identity/identity-events';
import { isDocumentEvent } from '../modules/document/document-events';
import { IdentitySync } from './identity-sync';
import { createMailSender, MailSender } from './mail-sender';

/**
 * Worker nhận event nghỉ phép từ queue (RabbitMQ khi local, SQS trên AWS) và gửi email (local: Mailpit qua SMTP; AWS: SES, MAIL_DRIVER=ses).
 * Chống trùng: id event (= id dòng outbox) được ghi vào notification.processed_event sau khi gửi;
 * gặp lại id đã xử lý thì bỏ qua. Lỗi gửi → DLQ để xem lại, không lặp vô hạn
 * (RabbitMQ: nack ngay; SQS: sau maxReceiveCount lần).
 */
@Injectable()
export class NotificationWorker implements OnApplicationShutdown {
  private readonly logger = new Logger(NotificationWorker.name);
  private consumer: EventConsumer | null = null;
  private readonly mailer: MailSender;

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly employees: EmployeeService,
    private readonly identity: IdentitySync,
  ) {
    this.mailer = createMailSender(cfg);
  }

  async start(consumer: EventConsumer = createEventConsumer(this.cfg)) {
    this.consumer = consumer;
    await consumer.start((e) => this.handle(e.id, e.type as LeaveEventType, e.payload as LeaveEventPayload).then(() => undefined));
  }

  /** Trả về true nếu đã gửi email, false nếu bỏ qua vì trùng. */
  async handle(eventId: string, type: LeaveEventType, payload: LeaveEventPayload): Promise<boolean> {
    const seen = await this.ds.query('SELECT 1 FROM notification.processed_event WHERE event_id = $1', [eventId]);
    if (seen.length) {
      this.logger.log(`Bỏ qua event trùng ${eventId}`);
      return false;
    }

    if (isDocumentEvent(type)) {
      // Event tài liệu dành cho assistant service (UC6); notification không gửi email cho tài liệu (UC5 D2).
      return false;
    }

    if (isIdentityEvent(type)) {
      // UC8: tài khoản, vai trò → IdP (identity-sync). Lỗi thì ném ra để message vào DLQ, không đánh dấu đã xử lý.
      await this.identity.handle(type, payload as never);
      await this.ds.query(
        'INSERT INTO notification.processed_event (event_id, event_type) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [eventId, type],
      );
      return true;
    }

    if (isProfileEvent(type)) {
      await this.handleProfile(type, payload as unknown as ProfileEventPayload);
      await this.ds.query(
        'INSERT INTO notification.processed_event (event_id, event_type) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [eventId, type],
      );
      return true;
    }

    // Email chung theo nhóm người nhận (BR-15): không tên, loại phép, ngày, mã đơn; log chỉ có loại event và số người nhận.
    const sent = new Set<string>();
    for (const group of recipientsOf(type, payload)) {
      const emails = (await this.emailsOf(group, payload.employeeId)).filter((e) => !sent.has(e));
      if (!emails.length) continue;
      emails.forEach((e) => sent.add(e));
      await this.mailer.sendMail({ from: this.cfg.smtp.from, to: emails.join(', '), ...buildEmail(type, group) });
    }
    this.logger.log(`${type} → ${sent.size} người nhận`);

    await this.ds.query(
      'INSERT INTO notification.processed_event (event_id, event_type) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [eventId, type],
    );
    return true;
  }

  /**
   * Email theo nhóm. `APPROVERS`: quản lý trực tiếp hiện tại và người duyệt thay đang hiệu lực (BR-05, BR-06); CEO hoặc người
   * chưa có quản lý (dữ liệu lỗi, UC4 E8) thì nhóm HR.
   */
  private async emailsOf(group: Recipient, ownerId: string): Promise<string[]> {
    if (group === 'OWNER') {
      const c = await this.employees.contactOf(ownerId);
      return c ? [c.email] : [];
    }
    if (group === 'APPROVERS') {
      const managerId = await this.employees.managerIdOf(ownerId);
      if (managerId) {
        const delegates: { delegate_id: string }[] = await this.ds.query(
          `SELECT delegate_id FROM leave.approval_delegation WHERE manager_id = $1 AND ended_at IS NULL
              AND start_date <= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AND end_date >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`,
          [managerId],
        );
        const ids = [managerId, ...delegates.map((d) => d.delegate_id)];
        const contacts = await Promise.all(ids.map((id) => this.employees.contactOf(id)));
        return contacts.filter((c): c is { email: string; fullName: string } => !!c).map((c) => c.email);
      }
      if (!(await this.employees.isCeo(ownerId))) this.logger.warn(`Nhân viên ${ownerId} chưa có quản lý trực tiếp: báo nhóm HR (UC4 E8)`);
    }
    const hr: { email: string }[] = await this.ds.query(
      `SELECT DISTINCT a.email FROM iam.user_account a JOIN iam.role_assignment r ON r.user_id = a.id
         LEFT JOIN employee.employee e ON e.id = a.employee_id
        WHERE r.role = 'HR' AND coalesce(e.status, '') <> 'TERMINATED' AND coalesce(a.employee_id::text, '') <> $1`,
      [ownerId],
    );
    return hr.map((h) => h.email);
  }

  /** Email của yêu cầu cập nhật hồ sơ: nhân viên nhận kết quả; HR nhận báo chung, gộp tối đa một email mỗi giờ. */
  private async handleProfile(type: ProfileEventType, p: ProfileEventPayload) {
    const mail = buildProfileEmail(type);
    if (type !== 'ProfileChangeSubmitted') {
      const to = await this.employees.contactOf(p.employeeId);
      if (to) await this.mailer.sendMail({ from: this.cfg.smtp.from, to: to.email, ...mail });
      this.logger.log(`${type} ${p.requestId}`);
      return;
    }
    const recent = await this.ds.query(
      `SELECT 1 FROM notification.processed_event WHERE event_type = 'ProfileHrDigest' AND processed_at > now() - make_interval(mins => $1) LIMIT 1`,
      [HR_DIGEST_INTERVAL_MINUTES],
    );
    if (recent.length) return;
    const hr: { email: string }[] = await this.ds.query(
      `SELECT DISTINCT a.email FROM iam.user_account a JOIN iam.role_assignment r ON r.user_id = a.id WHERE r.role = 'HR'`,
    );
    if (!hr.length) {
      this.logger.warn('Không có tài khoản HR nào để báo yêu cầu cập nhật hồ sơ');
      return;
    }
    await this.mailer.sendMail({ from: this.cfg.smtp.from, to: hr.map((h) => h.email).join(', '), ...mail });
    await this.ds.query(`INSERT INTO notification.processed_event (event_id, event_type) VALUES ($1, 'ProfileHrDigest')`, [
      `profile-digest-${Date.now()}`,
    ]);
    this.logger.log(`ProfileHrDigest → ${hr.length} HR`);
  }

  async onApplicationShutdown() {
    await this.consumer?.close().catch(() => undefined);
  }
}
