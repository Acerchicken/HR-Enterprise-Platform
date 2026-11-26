import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EmployeeService } from '../../employee/employee.service';
import { isProfileEvent, ProfileEventPayload } from '../../employee/profile-events';
import { isLeaveEvent, LeaveEventPayload, Recipient, recipientsOf } from './leave-events';

/**
 * Người nhận email của một event, gắn vào payload trước khi đẩy lên queue (ADR-15 bước 1, event-carried state transfer):
 * notification service chỉ gửi email theo danh sách này, không đọc dữ liệu của module khác.
 * Chỉ có địa chỉ email, không tên hay trường nhạy cảm (ADR-08); email là câu báo chung (BR-15).
 */
export interface MailGroup {
  group: Recipient;
  to: string[];
}

export type WithRecipients<T> = T & { mail: MailGroup[] };

/**
 * Tính người nhận lúc outbox publisher đẩy event (API, cùng database), tức là theo dữ liệu hiện tại như worker cũ làm lúc nhận
 * event: quản lý trực tiếp, người duyệt thay đang hiệu lực, nhóm HR (BR-05, BR-06, BR-16, UC4 E8).
 */
@Injectable()
export class NotificationRecipients {
  private readonly logger = new Logger(NotificationRecipients.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly employees: EmployeeService,
  ) {}

  /** Event không gửi email (identity, tài liệu) thì trả nguyên payload. */
  async attach(type: string, payload: unknown): Promise<unknown> {
    if (isLeaveEvent(type)) {
      const p = payload as LeaveEventPayload;
      const sent = new Set<string>();
      const mail: MailGroup[] = [];
      // Một người thuộc nhiều nhóm (ví dụ quản lý cũng là HR) chỉ nhận email của nhóm đầu tiên.
      for (const group of recipientsOf(type, p)) {
        const to = (await this.emailsOf(group, p.employeeId)).filter((e) => !sent.has(e));
        to.forEach((e) => sent.add(e));
        if (to.length) mail.push({ group, to });
      }
      return { ...p, mail };
    }
    if (isProfileEvent(type)) {
      const p = payload as ProfileEventPayload;
      if (type === 'ProfileChangeSubmitted') {
        const to = await this.activeHrEmails();
        if (!to.length) this.logger.warn('Không có tài khoản HR nào để báo yêu cầu cập nhật hồ sơ');
        return { ...p, mail: to.length ? [{ group: 'HR', to }] : [] };
      }
      const c = await this.employees.contactOf(p.employeeId);
      return { ...p, mail: c ? [{ group: 'OWNER', to: [c.email] }] : [] };
    }
    return payload;
  }

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
    return this.activeHrEmails(ownerId);
  }

  /** HR đang làm việc; không gửi cho chính chủ đơn khi người đó là HR. */
  private async activeHrEmails(exceptEmployeeId = ''): Promise<string[]> {
    const hr: { email: string }[] = await this.ds.query(
      `SELECT DISTINCT a.email FROM iam.user_account a JOIN iam.role_assignment r ON r.user_id = a.id
         LEFT JOIN employee.employee e ON e.id = a.employee_id
        WHERE r.role = 'HR' AND coalesce(e.status, '') <> 'TERMINATED' AND coalesce(a.employee_id::text, '') <> $1`,
      [exceptEmployeeId],
    );
    return hr.map((h) => h.email);
  }
}
