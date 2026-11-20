import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, Not, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../identity/roles';
import { OrganizationService } from '../organization/organization.service';
import { Employee } from './employee.entity';
import { EmployeeService } from './employee.service';
import { EmploymentAssignment } from './employment-assignment.entity';
import { CreateTransferDto, TerminationImpact, TransferView } from './transfer.dto';
import { addDays, pendingAsNewManager, vnToday } from './transfer-rules';

const ACTIVE_STATUSES = ['ACTIVE', 'ON_LEAVE'];

/**
 * UC2 FR-2.7, FR-2.8: điều chuyển có ngày hiệu lực và quá trình công tác. Hiệu lực hôm nay (hoặc lùi tối đa 30 ngày) áp dụng
 * ngay; hiệu lực tương lai là dòng SCHEDULED, job `applyDue()` trong worker áp dụng khi tới ngày và kiểm lại quy tắc (AC-2.7.8).
 */
@Injectable()
export class TransferService {
  private readonly logger = new Logger(TransferService.name);

  constructor(
    @InjectRepository(EmploymentAssignment) private readonly rows: Repository<EmploymentAssignment>,
    @InjectRepository(Employee) private readonly employees: Repository<Employee>,
    private readonly org: OrganizationService,
    private readonly employeeService: EmployeeService,
    private readonly audit: AuditService,
  ) {}

  async create(employeeId: string, dto: CreateTransferDto, actor: AuthUser, today = vnToday()): Promise<TransferView> {
    const e = await this.employees.findOneBy({ id: employeeId });
    if (!e) throw new NotFoundException('Không tìm thấy nhân viên');
    if (e.status === 'TERMINATED') throw new BadRequestException('Nhân viên đã nghỉ việc');
    const fields: Record<string, string> = {};
    if (dto.effectiveDate < e.hireDate) fields.effectiveDate = 'Ngày hiệu lực trước ngày vào làm';
    else if (dto.effectiveDate < addDays(today, -30)) fields.effectiveDate = 'Ngày hiệu lực chỉ được lùi tối đa 30 ngày';
    const current = await this.rows.findOneBy({ employeeId, status: 'ACTIVE' });
    if (!fields.effectiveDate && current && dto.effectiveDate < current.effectiveFrom) {
      // Cùng ngày được (sửa nhầm trong ngày): giai đoạn trước thành rỗng và không hiện trong quá trình công tác.
      fields.effectiveDate = `Ngày hiệu lực không được trước ngày bắt đầu giai đoạn hiện tại (${current.effectiveFrom})`;
    }
    if (await this.rows.existsBy({ employeeId, status: 'SCHEDULED', parentId: IsNull() })) {
      throw new ConflictException('Nhân viên đã có điều chuyển chưa hiệu lực; hãy hủy điều chuyển đó trước');
    }
    const lookups = await this.org.lookups();
    const dept = lookups.department.get(dto.departmentId);
    if (!dept) fields.departmentId = 'Đơn vị không tồn tại';
    else if (dept.status !== 'ACTIVE') fields.departmentId = 'Đơn vị đã ngừng hoạt động';
    const pos = lookups.position.get(dto.positionId);
    if (!pos) fields.positionId = 'Chức danh không tồn tại';
    else if (!pos.active && dto.positionId !== e.positionId) fields.positionId = 'Chức danh đã ngừng dùng';
    if (dto.departmentId === e.departmentId && dto.positionId === e.positionId && dto.managerId === e.managerId) {
      throw new BadRequestException('Điều chuyển không thay đổi đơn vị, chức danh hay quản lý');
    }

    // AC-2.7.6: chọn cho từng cấp dưới đang làm việc.
    const reports = await this.employees.find({ where: { managerId: employeeId, status: In(ACTIVE_STATUSES) }, select: { id: true, fullName: true } });
    const choices = new Map((dto.reports ?? []).map((r) => [r.employeeId, r.managerId]));
    const missing = reports.filter((r) => !choices.has(r.id));
    if (missing.length) {
      fields.reports = `Hãy chọn quản lý cho ${missing.length} cấp dưới: ${missing.slice(0, 5).map((r) => r.fullName).join(', ')}${missing.length > 5 ? '…' : ''}`;
    }
    const extra = [...choices.keys()].filter((id) => !reports.some((r) => r.id === id));
    if (extra.length) fields.reports = 'Danh sách cấp dưới đã thay đổi; hãy tải lại';
    // AC-2.7.5: trưởng mới cho đơn vị người này đang làm trưởng mà sẽ không còn thuộc.
    const broken = await this.org.headRolesBrokenByMove(employeeId, dto.departmentId);
    const heads = dto.newHeads ?? [];
    const noHead = broken.filter((b) => !heads.some((h) => h.departmentId === b.departmentId));
    if (noHead.length) fields.newHeads = `Hãy chọn trưởng mới (hoặc để trống) cho: ${noHead.map((b) => b.name).join(', ')}`;
    if (Object.keys(fields).length) {
      throw new BadRequestException({ message: Object.values(fields).join('; '), fields });
    }

    const immediate = dto.effectiveDate <= today;
    const id = await this.rows.manager.transaction(async (m) => {
      const repo = m.getRepository(EmploymentAssignment);
      const main = await repo.save(
        repo.create({
          employeeId,
          departmentId: dto.departmentId,
          positionId: dto.positionId,
          managerId: dto.managerId,
          effectiveFrom: dto.effectiveDate,
          reason: dto.reason,
          note: dto.note ?? null,
          status: 'SCHEDULED',
          headChanges: heads.length ? heads : null,
          createdBy: actor.employeeId,
        }),
      );
      const moved = reports.filter((r) => choices.get(r.id) !== employeeId);
      if (moved.length) {
        const current = await m.getRepository(Employee).find({ where: { id: In(moved.map((r) => r.id)) } });
        await repo.insert(
          current.map((r) => ({
            employeeId: r.id,
            departmentId: r.departmentId,
            positionId: r.positionId,
            managerId: choices.get(r.id)!,
            effectiveFrom: dto.effectiveDate,
            reason: 'MANAGER_CHANGE' as const,
            note: 'Đổi quản lý theo điều chuyển của quản lý cũ',
            status: 'SCHEDULED' as const,
            parentId: main.id,
            createdBy: actor.employeeId,
          })),
        );
      }
      if (immediate) await this.apply(m, main, actor);
      else {
        await this.audit.record(
          { actorId: actor.employeeId, action: 'TRANSFER_SCHEDULE', entityType: 'employee', entityId: employeeId, changedFields: { transferId: main.id, effectiveDate: dto.effectiveDate, departmentId: dto.departmentId, positionId: dto.positionId, managerId: dto.managerId } },
          m,
        );
      }
      return main.id;
    });
    return this.view(id);
  }

  /** HR hủy điều chuyển chưa hiệu lực (AC-2.7.2), kéo theo dòng của cấp dưới. */
  async cancel(employeeId: string, transferId: string, actor: AuthUser): Promise<void> {
    const t = await this.rows.findOneBy({ id: transferId, employeeId, parentId: IsNull() });
    if (!t || t.reason === 'HIRE') throw new NotFoundException('Không tìm thấy điều chuyển');
    if (t.status !== 'SCHEDULED') throw new ConflictException('Chỉ hủy được điều chuyển chưa hiệu lực');
    await this.rows.manager.transaction(async (m) => {
      await m.query(`UPDATE employee.employment_assignment SET status = 'CANCELLED' WHERE (id = $1 OR parent_id = $1) AND status = 'SCHEDULED'`, [t.id]);
      await this.audit.record({ actorId: actor.employeeId, action: 'TRANSFER_CANCEL', entityType: 'employee', entityId: employeeId, changedFields: { transferId: t.id } }, m);
    });
  }

  async list(employeeId: string): Promise<TransferView[]> {
    if (!(await this.employees.existsBy({ id: employeeId }))) throw new NotFoundException('Không tìm thấy nhân viên');
    const mains = await this.rows.find({
      where: { employeeId, parentId: IsNull(), reason: Not('HIRE') },
      order: { effectiveFrom: 'DESC', createdAt: 'DESC' },
    });
    return Promise.all(mains.map((t) => this.view(t.id)));
  }

  /**
   * Job (worker, mỗi 5 phút): áp dụng các điều chuyển tới ngày. Mỗi điều chuyển một giao dịch, khóa bằng SKIP LOCKED để nhiều
   * instance chạy cùng lúc vẫn an toàn; sai quy tắc lúc áp dụng thì dòng thành FAILED (AC-2.7.8).
   */
  async applyDue(today = vnToday()): Promise<{ applied: number; failed: number }> {
    let applied = 0;
    let failed = 0;
    for (let i = 0; i < 1000; i++) {
      const done = await this.rows.manager.transaction(async (m) => {
        const [row] = await m.query(
          `SELECT id FROM employee.employment_assignment
            WHERE status = 'SCHEDULED' AND parent_id IS NULL AND effective_from <= $1
            ORDER BY effective_from, created_at LIMIT 1 FOR UPDATE SKIP LOCKED`,
          [today],
        );
        if (!row) return null;
        const t = await m.getRepository(EmploymentAssignment).findOneByOrFail({ id: row.id });
        await m.query('SAVEPOINT transfer_apply');
        try {
          await this.apply(m, t, null);
          await m.query('RELEASE SAVEPOINT transfer_apply');
          return 'applied';
        } catch (err) {
          await m.query('ROLLBACK TO SAVEPOINT transfer_apply');
          const reason = (err as Error).message.slice(0, 300);
          await m.query(
            `UPDATE employee.employment_assignment SET status = 'FAILED', failure_reason = $2 WHERE (id = $1 OR parent_id = $1) AND status = 'SCHEDULED'`,
            [t.id, reason],
          );
          await this.audit.record({ actorId: null, action: 'TRANSFER_FAIL', entityType: 'employee', entityId: t.employeeId, changedFields: { transferId: t.id, reason } }, m);
          this.logger.warn(`Điều chuyển ${t.id} không áp dụng được: ${reason}`);
          return 'failed';
        }
      });
      if (!done) break;
      if (done === 'applied') applied++;
      else failed++;
    }
    return { applied, failed };
  }

  /** Hộp xác nhận nghỉ việc (UC1 AC-1.7.3, UC2 AC-2.9.8): nêu trước các thay đổi sẽ xảy ra. */
  async terminationImpact(employeeId: string): Promise<TerminationImpact> {
    if (!(await this.employees.existsBy({ id: employeeId }))) throw new NotFoundException('Không tìm thấy nhân viên');
    const [activeReports, headRoles, scheduledTransfers, pending] = await Promise.all([
      this.employees.count({ where: { managerId: employeeId, status: In(ACTIVE_STATUSES) } }),
      this.org.rolesOf(employeeId),
      this.rows.count({ where: { employeeId, status: 'SCHEDULED' } }),
      pendingAsNewManager(this.rows.manager, employeeId),
    ]);
    const roles: { role: 'HR' | 'ADMIN'; others: number }[] = await this.rows.manager.query(
      `SELECT r.role,
              (SELECT count(*)::int FROM iam.role_assignment o
                 JOIN iam.user_account oa ON oa.id = o.user_id
                 LEFT JOIN employee.employee oe ON oe.id = oa.employee_id
                WHERE o.role = 'ADMIN' AND o.user_id <> r.user_id AND coalesce(oe.status, '') <> 'TERMINATED') AS others
         FROM iam.role_assignment r JOIN iam.user_account a ON a.id = r.user_id
        WHERE a.employee_id = $1 AND r.role IN ('HR', 'ADMIN') ORDER BY r.role DESC`,
      [employeeId],
    );
    // Đọc chéo schema leave bằng SQL (database-schema.md mục 9): Leave phụ thuộc Employee nên Employee không gọi service Leave.
    const [leave] = await this.rows.manager.query(
      `SELECT count(*) FILTER (WHERE status IN ('SUBMITTED', 'PENDING_HR'))::int AS pending,
              count(*) FILTER (WHERE status = 'APPROVED' AND start_date > $2)::int AS approved_future
         FROM leave.leave_request WHERE employee_id = $1`,
      [employeeId, vnToday()],
    );
    return {
      leave: { pending: leave.pending, approvedFuture: leave.approved_future },
      activeReports,
      headRoles,
      scheduledTransfers,
      pendingAsNewManager: pending,
      grantedRoles: roles.map((r) => r.role),
      lastAdmin: roles.some((r) => r.role === 'ADMIN' && r.others === 0),
    };
  }

  // ---------- Nội bộ ----------

  /** Áp dụng một điều chuyển (và dòng của cấp dưới) trong giao dịch `m`. Lỗi quy tắc thì ném lỗi, không đổi gì. */
  private async apply(m: EntityManager, t: EmploymentAssignment, actor: AuthUser | null): Promise<void> {
    const repo = m.getRepository(Employee);
    const e = await repo.findOne({ where: { id: t.employeeId }, lock: { mode: 'pessimistic_write' } });
    if (!e || e.status === 'TERMINATED') throw new BadRequestException('Nhân viên đã nghỉ việc');
    const lookups = await this.org.lookups();
    // Đọc thẳng trạng thái đơn vị (không qua cache) vì job chạy ở process khác (AC-2.7.8).
    const [target] = await m.query(`SELECT status FROM org.department WHERE id = $1`, [t.departmentId]);
    if (target?.status !== 'ACTIVE') throw new BadRequestException('Đơn vị đích đã ngừng hoạt động');
    await this.employeeService.assertManagerRule(m, lookups, { employeeId: e.id, positionId: t.positionId, managerId: t.managerId });
    if (t.managerId) await this.employeeService.assertNoManagerCycle(m, e.id, t.managerId);

    const before = { departmentId: e.departmentId, positionId: e.positionId, managerId: e.managerId };
    await this.switchRow(m, t);
    await repo.save({ ...e, departmentId: t.departmentId, positionId: t.positionId, managerId: t.managerId });
    if (t.departmentId !== before.departmentId) await this.org.applyMove(e.id, t.departmentId, t.headChanges ?? [], actor, m);
    await this.audit.record(
      { actorId: actor?.employeeId ?? null, action: 'TRANSFER', entityType: 'employee', entityId: e.id, changedFields: diff(before, t, { transferId: t.id, reason: t.reason, effectiveDate: t.effectiveFrom }) },
      m,
    );

    // Cấp dưới đổi quản lý cùng ngày hiệu lực (AC-2.7.6).
    const children = await m.getRepository(EmploymentAssignment).find({ where: { parentId: t.id, status: 'SCHEDULED' } });
    for (const c of children) {
      const r = await repo.findOne({ where: { id: c.employeeId }, lock: { mode: 'pessimistic_write' } });
      if (!r || r.status === 'TERMINATED') {
        await m.query(`UPDATE employee.employment_assignment SET status = 'CANCELLED' WHERE id = $1`, [c.id]);
        continue;
      }
      await this.employeeService.assertManagerRule(m, lookups, { employeeId: r.id, positionId: r.positionId, managerId: c.managerId });
      if (c.managerId) await this.employeeService.assertNoManagerCycle(m, r.id, c.managerId);
      // Đơn vị, chức danh của cấp dưới lấy giá trị hiện tại (có thể đã đổi từ lúc lên lịch).
      c.departmentId = r.departmentId;
      c.positionId = r.positionId;
      await this.switchRow(m, c);
      await repo.save({ ...r, managerId: c.managerId });
      await this.audit.record(
        { actorId: actor?.employeeId ?? null, action: 'TRANSFER', entityType: 'employee', entityId: r.id, changedFields: diff({ departmentId: r.departmentId, positionId: r.positionId, managerId: r.managerId }, c, { transferId: c.id, reason: c.reason, effectiveDate: c.effectiveFrom }) },
        m,
      );
    }
  }

  /** Đóng dòng ACTIVE hiện tại ở ngày trước hiệu lực và mở dòng mới. */
  private async switchRow(m: EntityManager, t: EmploymentAssignment) {
    await m.query(
      `UPDATE employee.employment_assignment SET status = 'CLOSED', effective_to = $2::date - 1
        WHERE employee_id = $1 AND status = 'ACTIVE'`,
      [t.employeeId, t.effectiveFrom],
    );
    await m.query(
      `UPDATE employee.employment_assignment SET status = 'ACTIVE', applied_at = now(), department_id = $2, position_id = $3 WHERE id = $1`,
      [t.id, t.departmentId, t.positionId],
    );
  }

  private async view(id: string): Promise<TransferView> {
    const t = await this.rows.findOneByOrFail({ id });
    const children = await this.rows.find({ where: { parentId: id } });
    const ids = [...new Set([t.managerId, ...children.flatMap((c) => [c.employeeId, c.managerId])].filter((x): x is string => !!x))];
    const names = new Map(
      ids.length ? (await this.employees.find({ where: { id: In(ids) }, select: { id: true, fullName: true } })).map((x) => [x.id, x.fullName]) : [],
    );
    const lookups = await this.org.lookups();
    return {
      id: t.id,
      employeeId: t.employeeId,
      status: t.status,
      reason: t.reason,
      effectiveDate: t.effectiveFrom,
      departmentId: t.departmentId,
      departmentName: lookups.department.get(t.departmentId)?.name ?? null,
      positionId: t.positionId,
      positionTitle: lookups.position.get(t.positionId)?.title ?? null,
      managerId: t.managerId,
      managerName: t.managerId ? (names.get(t.managerId) ?? null) : null,
      note: t.note,
      failureReason: t.failureReason,
      reports: children.map((c) => ({ employeeId: c.employeeId, fullName: names.get(c.employeeId) ?? null, managerId: c.managerId, status: c.status })),
      createdAt: t.createdAt.toISOString(),
    };
  }
}

function diff(
  before: { departmentId: string; positionId: string; managerId: string | null },
  after: { departmentId: string; positionId: string; managerId: string | null },
  extra: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...extra };
  for (const k of ['departmentId', 'positionId', 'managerId'] as const) {
    if (before[k] !== after[k]) out[k] = { from: before[k], to: after[k] };
  }
  return out;
}
