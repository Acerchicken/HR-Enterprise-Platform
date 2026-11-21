import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { EmployeeService, RequestMeta } from '../employee/employee.service';
import { vnToday } from '../employee/transfer-rules';
import { AuthUser } from '../identity/roles';
import { LeaveCalendar } from './leave-calendar';
import { ApprovalDelegation } from './leave-delegation.entity';
import { Holiday } from './leave-holiday.entity';
import { isValidDate } from './leave-rules';
import { CreateDelegationDto, CreateHolidayDto, DelegationQuery } from './leave.dto';
import { LeaveService } from './leave.service';

/** Việc của HR: lịch lễ (FR-4.9, BR-19) và phân công duyệt thay (FR-4.3, BR-06). */
@Injectable()
export class LeaveAdminService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly calendar: LeaveCalendar,
    private readonly leave: LeaveService,
    private readonly employees: EmployeeService,
    private readonly audit: AuditService,
  ) {}

  // ---------- Lịch lễ ----------

  listHolidays(year: number) {
    return this.ds.getRepository(Holiday).createQueryBuilder('h')
      .where('h.holiday_date BETWEEN :a AND :b', { a: `${year}-01-01`, b: `${year}-12-31` })
      .orderBy('h.holiday_date')
      .getMany();
  }

  /** Thêm ngày lễ, nghỉ bù: không tự sửa đơn đã gửi, chỉ báo số đơn bị ảnh hưởng (BR-19). */
  async addHoliday(dto: CreateHolidayDto, actor: AuthUser, meta: RequestMeta) {
    if (!isValidDate(dto.date)) throw new BadRequestException({ message: 'Ngày không hợp lệ', fields: ['date'] });
    const affectedRequests = await this.ds.transaction(async (m) => {
      if (await m.getRepository(Holiday).existsBy({ date: dto.date })) throw new ConflictException('Ngày này đã có trong lịch');
      await m.insert(Holiday, { date: dto.date, name: dto.name, kind: dto.kind, createdBy: actor.employeeId });
      await this.audit.record({ actorId: actor.employeeId, action: 'HOLIDAY_CREATE', entityType: 'holiday', entityId: dto.date, changedFields: { name: dto.name, kind: dto.kind }, ...meta }, m);
      return this.leave.countCovering(m, dto.date);
    });
    this.calendar.invalidate();
    return { date: dto.date, name: dto.name, kind: dto.kind, affectedRequests };
  }

  async deleteHoliday(date: string, actor: AuthUser, meta: RequestMeta) {
    const affectedRequests = await this.ds.transaction(async (m) => {
      const h = await m.getRepository(Holiday).findOneBy({ date });
      if (!h) throw new NotFoundException('Không có ngày này trong lịch');
      await m.delete(Holiday, { date });
      await this.audit.record({ actorId: actor.employeeId, action: 'HOLIDAY_DELETE', entityType: 'holiday', entityId: date, changedFields: { name: h.name, kind: h.kind }, ...meta }, m);
      return this.leave.countCovering(m, date);
    });
    this.calendar.invalidate();
    return { affectedRequests };
  }

  // ---------- Người duyệt thay ----------

  async createDelegation(dto: CreateDelegationDto, actor: AuthUser, meta: RequestMeta) {
    if (!isValidDate(dto.startDate) || !isValidDate(dto.endDate) || dto.endDate < dto.startDate) {
      throw new BadRequestException({ message: 'Khoảng ngày không hợp lệ', fields: ['endDate'] });
    }
    if (dto.endDate < vnToday()) throw new BadRequestException({ message: 'Khoảng ngày đã qua', fields: ['endDate'] });
    if (dto.managerId === dto.delegateId) throw new BadRequestException({ message: 'Người duyệt thay phải khác quản lý vắng', fields: ['delegateId'] });
    const id = await this.ds.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`delegation:${dto.managerId}`]);
      for (const [field, who] of [['managerId', dto.managerId], ['delegateId', dto.delegateId]] as const) {
        const place = await this.employees.placementOf(who);
        if (!place || place.status === 'TERMINATED') throw new BadRequestException({ message: 'Nhân viên không tồn tại hoặc đã nghỉ việc', fields: [field] });
        if (!(await this.employees.hasDirectReports(who))) {
          throw new BadRequestException({ message: field === 'managerId' ? 'Người này không có cấp dưới trực tiếp' : 'Người duyệt thay phải là quản lý đang có cấp dưới (BR-06)', fields: [field] });
        }
      }
      const clash = await m.query(
        `SELECT 1 FROM leave.approval_delegation WHERE manager_id = $1 AND ended_at IS NULL AND start_date <= $3 AND end_date >= $2`,
        [dto.managerId, dto.startDate, dto.endDate],
      );
      if (clash.length) throw new ConflictException('Quản lý này đã có phân công duyệt thay chồng lấn khoảng ngày (BR-06)');
      const saved = await m.save(m.create(ApprovalDelegation, { ...dto, createdBy: actor.employeeId! }));
      await this.audit.record({ actorId: actor.employeeId, action: 'DELEGATION_CREATE', entityType: 'approval_delegation', entityId: saved.id, changedFields: { ...dto }, ...meta }, m);
      return saved.id;
    });
    return (await this.listDelegations({})).find((d) => d.id === id)!;
  }

  async endDelegation(id: string, actor: AuthUser, meta: RequestMeta) {
    await this.ds.transaction(async (m) => {
      const d = await m.findOne(ApprovalDelegation, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!d) throw new NotFoundException('Không tìm thấy phân công');
      if (d.endedAt) return;
      await m.update(ApprovalDelegation, { id }, { endedAt: new Date(), endedBy: actor.employeeId });
      await this.audit.record({ actorId: actor.employeeId, action: 'DELEGATION_END', entityType: 'approval_delegation', entityId: id, changedFields: null, ...meta }, m);
    });
    return (await this.listDelegations({})).find((d) => d.id === id)!;
  }

  async listDelegations(q: DelegationQuery) {
    const qb = this.ds.getRepository(ApprovalDelegation).createQueryBuilder('d').orderBy('d.start_date', 'DESC').addOrderBy('d.created_at', 'DESC');
    if (q.managerId) qb.andWhere('d.manager_id = :mid', { mid: q.managerId });
    if (q.activeOn) qb.andWhere('d.ended_at IS NULL AND d.start_date <= :on AND d.end_date >= :on', { on: q.activeOn });
    const rows = await qb.take(200).getMany();
    const names = await this.employees.namesOf(rows.flatMap((d) => [d.managerId, d.delegateId]));
    const today = vnToday();
    return rows.map((d) => ({
      ...d,
      managerName: names.get(d.managerId) ?? null,
      delegateName: names.get(d.delegateId) ?? null,
      active: !d.endedAt && d.startDate <= today && d.endDate >= today,
    }));
  }
}
