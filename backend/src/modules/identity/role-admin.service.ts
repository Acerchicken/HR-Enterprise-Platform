import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Page } from '../../common/pagination';
import { AuditService } from '../audit/audit.service';
import { RoleEventPayload } from './identity-events';
import { isSelfChange, wouldRemoveLastAdmin } from './role-access';
import { AssignableRole, GrantRoleDto, RoleAssignmentQuery, RoleAssignmentView } from './role-admin.dto';
import { AuthUser } from './roles';
import { writeOutbox } from '../../messaging/outbox';

const SELECT_VIEW = `SELECT r.user_id, a.employee_id, e.full_name, a.email, d.name AS department_name, r.role,
       r.granted_by, COALESCE(ge.full_name, ga.email) AS granted_by_name, r.granted_at, r.reason
  FROM iam.role_assignment r
  JOIN iam.user_account a ON a.id = r.user_id
  LEFT JOIN employee.employee e ON e.id = a.employee_id
  LEFT JOIN org.department d ON d.id = e.department_id
  LEFT JOIN iam.user_account ga ON ga.id = r.granted_by
  LEFT JOIN employee.employee ge ON ge.id = ga.employee_id`;

/**
 * ADMIN cấp, thu hồi vai trò HR, ADMIN (UC8 FR-8.7, luồng 4.4 và A7; ADR-18 quyết định 2).
 * Mỗi thay đổi: dòng `iam.role_assignment` + audit + event outbox trong cùng một giao dịch (ADR-09, ADR-03).
 * Quyền có hiệu lực ở request kế tiếp vì `IdentityService` đọc database mỗi request. Đọc tên, đơn vị từ schema `employee`, `org`
 * (chỉ trường mức danh bạ; ADMIN không xem hồ sơ cá nhân, NFR-5.13).
 */
@Injectable()
export class RoleAdminService {
  constructor(
    private readonly ds: DataSource,
    private readonly audit: AuditService,
  ) {}

  /** AC-8.7.8: danh sách lọc, tìm, phân trang ngay trong SQL (authorization.md lớp 3). */
  async list(q: RoleAssignmentQuery): Promise<Page<RoleAssignmentView>> {
    const where = [`r.role IN ('HR', 'ADMIN')`];
    const params: unknown[] = [];
    if (q.role) {
      params.push(q.role);
      where.push(`r.role = $${params.length}`);
    }
    if (q.q) {
      params.push(`%${q.q.replace(/[\\%_]/g, (c) => '\\' + c)}%`);
      where.push(`(e.full_name ILIKE $${params.length} OR a.email ILIKE $${params.length})`);
    }
    const filter = `WHERE ${where.join(' AND ')}`;
    const [{ total }] = await this.ds.query(
      `SELECT count(*)::int AS total FROM iam.role_assignment r JOIN iam.user_account a ON a.id = r.user_id
       LEFT JOIN employee.employee e ON e.id = a.employee_id ${filter}`,
      params,
    );
    const rows = await this.ds.query(
      `${SELECT_VIEW} ${filter} ORDER BY r.granted_at DESC, e.full_name, r.role
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.size, (q.page - 1) * q.size],
    );
    return { items: rows.map(toView), page: q.page, size: q.size, total };
  }

  async grant(actor: AuthUser, dto: GrantRoleDto): Promise<RoleAssignmentView> {
    return this.ds.transaction(async (m) => {
      const [target] = await m.query(
        `SELECT a.id, a.email, e.status FROM employee.employee e LEFT JOIN iam.user_account a ON a.employee_id = e.id WHERE e.id = $1`,
        [dto.employeeId],
      );
      if (!target) throw new BadRequestException('Không tìm thấy nhân viên');
      if (!target.id) throw new BadRequestException('Nhân viên chưa có tài khoản đăng nhập'); // E10
      if (isSelfChange(actor, target.id)) throw new ForbiddenException('Không tự cấp, thu hồi vai trò của mình'); // E11
      if (target.status === 'TERMINATED') throw new BadRequestException('Nhân viên đã nghỉ việc'); // E13
      const inserted = await m.query(
        `INSERT INTO iam.role_assignment (user_id, role, granted_by, reason) VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, role) DO NOTHING RETURNING user_id`,
        [target.id, dto.role, actor.userId, dto.reason],
      );
      if (!inserted.length) throw new ConflictException(`Người này đã có vai trò ${dto.role}`); // E14
      await this.record(m, actor, 'ROLE_GRANT', 'RoleGranted', { accountId: target.id, email: target.email, role: dto.role }, dto.reason);
      const [row] = await m.query(`${SELECT_VIEW} WHERE r.user_id = $1 AND r.role = $2`, [target.id, dto.role]);
      return toView(row);
    });
  }

  async revoke(actor: AuthUser, userId: string, role: string, reason: string): Promise<void> {
    if (role !== 'HR' && role !== 'ADMIN') throw new BadRequestException('role chỉ là HR hoặc ADMIN');
    await this.ds.transaction(async (m) => {
      if (role === 'ADMIN') {
        // Khóa mọi dòng ADMIN để hai lệnh thu hồi song song không cùng thấy "vẫn còn người khác" (E12).
        const admins: { user_id: string; status: string | null }[] = await m.query(
          `SELECT r.user_id, e.status FROM iam.role_assignment r
             JOIN iam.user_account a ON a.id = r.user_id
             LEFT JOIN employee.employee e ON e.id = a.employee_id
           WHERE r.role = 'ADMIN' FOR UPDATE OF r`,
        );
        if (!admins.some((x) => x.user_id === userId)) throw new NotFoundException('Không có vai trò này');
        const active = admins.filter((x) => x.status !== 'TERMINATED').map((x) => x.user_id);
        // E12 kiểm trước E11: ADMIN duy nhất tự thu hồi thì nhận lý do đúng là "phải còn một ADMIN" (AC-8.7.4).
        if (wouldRemoveLastAdmin(active, userId)) throw new ConflictException('Phải còn ít nhất một ADMIN'); // E12
      }
      if (isSelfChange(actor, userId)) throw new ForbiddenException('Không tự cấp, thu hồi vai trò của mình'); // E11
      const deleted: { email: string }[] = await m.query(
        `DELETE FROM iam.role_assignment r USING iam.user_account a
          WHERE a.id = r.user_id AND r.user_id = $1 AND r.role = $2 RETURNING a.email`,
        [userId, role],
      );
      // node-postgres trả [rows, rowCount] cho DELETE … RETURNING qua TypeORM.
      const rows = Array.isArray(deleted[0]) ? (deleted[0] as unknown as { email: string }[]) : deleted;
      if (!rows.length) throw new NotFoundException('Không có vai trò này');
      await this.record(m, actor, 'ROLE_REVOKE', 'RoleRevoked', { accountId: userId, email: rows[0].email, role: role as AssignableRole }, reason);
    });
  }

  private async record(m: EntityManager, actor: AuthUser, action: string, event: string, p: RoleEventPayload, reason: string) {
    await this.audit.record(
      { actorId: actor.employeeId, action, entityType: 'role_assignment', entityId: p.accountId, changedFields: { userId: p.accountId, role: p.role, reason } },
      m,
    );
    await writeOutbox(m, event, p.accountId, { ...p, occurredAt: new Date().toISOString() });
  }
}

function toView(r: Record<string, any>): RoleAssignmentView {
  return {
    userId: r.user_id,
    employeeId: r.employee_id,
    fullName: r.full_name,
    email: r.email,
    departmentName: r.department_name,
    role: r.role,
    grantedBy: r.granted_by ? { id: r.granted_by, fullName: r.granted_by_name } : null,
    grantedAt: new Date(r.granted_at).toISOString(),
    reason: r.reason,
  };
}
