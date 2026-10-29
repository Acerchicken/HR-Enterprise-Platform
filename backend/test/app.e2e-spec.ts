/**
 * E2E test chạy với database thật (đã migrate + seed) và AUTH_MODE=dev.
 *   npm run migration:run && npm run seed && npm run test:e2e
 */
process.env.AUTH_MODE = 'dev';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { loadConfig } from '../src/config/config';

const as = (email: string) => ({ Authorization: `Bearer dev:${email}` });
const EMPLOYEE = as('employee@hr.local');
const MANAGER = as('manager@hr.local');
const HR = as('hr@hr.local');
const ADMIN = as('admin@hr.local');

describe('HR Platform API (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let employeeId: string;
  let managerId: string;
  let strangerId: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app, loadConfig());
    await app.init();
    http = request(app.getHttpServer());

    employeeId = (await http.get('/api/v1/me').set(EMPLOYEE)).body.employee.id;
    managerId = (await http.get('/api/v1/me').set(MANAGER)).body.employee.id;
    const page = await http.get('/api/v1/employees?q=hr.local&size=50').set(EMPLOYEE);
    strangerId = page.body.items.find((e: any) => e.managerId !== managerId && e.id !== employeeId && e.id !== managerId).id;
  });

  afterAll(() => app.close());

  it('health không cần đăng nhập', async () => {
    await http.get('/api/v1/health').expect(200, { status: 'ok' });
  });

  it('thiếu token → 401 với format lỗi chuẩn', async () => {
    const res = await http.get('/api/v1/me').expect(401);
    expect(res.body).toMatchObject({ code: 'UNAUTHENTICATED', traceId: expect.any(String) });
  });

  it('/me trả role suy ra từ dữ liệu', async () => {
    expect((await http.get('/api/v1/me').set(EMPLOYEE)).body.roles).toEqual(['EMPLOYEE']);
    expect((await http.get('/api/v1/me').set(MANAGER)).body.roles.sort()).toEqual(['EMPLOYEE', 'MANAGER']);
    expect((await http.get('/api/v1/me').set(HR)).body.roles.sort()).toEqual(['EMPLOYEE', 'HR']);
  });

  it('danh bạ tìm kiếm và phân trang', async () => {
    const res = await http.get('/api/v1/employees?q=Trần Thị Nhân&size=5').set(EMPLOYEE).expect(200);
    expect(res.body.items[0]).toMatchObject({ workEmail: 'employee@hr.local', managerName: 'Nguyễn Văn Quản' });
    const all = await http.get('/api/v1/employees?size=100&page=2').set(EMPLOYEE).expect(200);
    expect(all.body.items).toHaveLength(100);
    expect(all.body.total).toBeGreaterThan(1900);
  });

  it('nhân viên xem hồ sơ người khác chỉ thấy thông tin danh bạ', async () => {
    const res = await http.get(`/api/v1/employees/${strangerId}`).set(EMPLOYEE).expect(200);
    expect(res.body.visibility).toBe('PUBLIC');
    expect(res.body.dateOfBirth).toBeUndefined();
  });

  it('quản lý trực tiếp thấy thông tin cá nhân, không thấy trường nhạy cảm', async () => {
    const res = await http.get(`/api/v1/employees/${employeeId}`).set(MANAGER).expect(200);
    expect(res.body.visibility).toBe('PERSONAL');
    expect(res.body.dateOfBirth).toBeDefined();
    await http.get(`/api/v1/employees/${employeeId}?include=sensitive`).set(MANAGER).expect(403);
    await http.get(`/api/v1/employees/${employeeId}?include=sensitive`).set(ADMIN).expect(403);
  });

  it('HR xem trường nhạy cảm (đã giải mã) và lượt xem được audit', async () => {
    const res = await http.get(`/api/v1/employees/${employeeId}?include=sensitive`).set(HR).expect(200);
    expect(res.body.sensitive.nationalId).toMatch(/^[0-9]{12}$/);
    const logs = await http
      .get(`/api/v1/audit-logs?entity=employee&entityId=${employeeId}`)
      .set(HR)
      .expect(200);
    expect(logs.body.items[0]).toMatchObject({ action: 'VIEW_SENSITIVE' });
  });

  it('nhân viên không xem được audit log', async () => {
    await http.get('/api/v1/audit-logs').set(EMPLOYEE).expect(403);
  });

  it('nhân viên tự sửa số điện thoại; không sửa được lương hay hồ sơ người khác', async () => {
    const me = (await http.get('/api/v1/me').set(EMPLOYEE)).body.employee;
    const phone = `0912 ${String(Date.now()).slice(-6)}`;
    const res = await http
      .patch(`/api/v1/employees/${employeeId}`)
      .set(EMPLOYEE)
      .send({ phone, version: me.version })
      .expect(200);
    expect(res.body.phone).toBe(phone);
    expect(res.body.version).toBe(me.version + 1);

    await http.patch(`/api/v1/employees/${employeeId}`).set(EMPLOYEE).send({ salary: '999999999' }).expect(403);
    await http.patch(`/api/v1/employees/${strangerId}`).set(EMPLOYEE).send({ phone: '0912000222' }).expect(403);
  });

  it('version cũ → 409 (optimistic locking)', async () => {
    const res = await http.patch(`/api/v1/employees/${employeeId}`).set(EMPLOYEE).send({ phone: '0912000333', version: 1 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
  });

  it('dữ liệu sai → 400', async () => {
    await http.patch(`/api/v1/employees/${employeeId}`).set(EMPLOYEE).send({ phone: 'abc' }).expect(400);
    await http.patch(`/api/v1/employees/${employeeId}`).set(EMPLOYEE).send({ unknownField: 1 }).expect(400);
  });

  it('HR không gán được quản lý tạo vòng lặp', async () => {
    await http.patch(`/api/v1/employees/${managerId}`).set(HR).send({ managerId: employeeId }).expect(400);
  });

  it('HR cập nhật lương: audit chỉ ghi tên trường, không ghi giá trị', async () => {
    await http.patch(`/api/v1/employees/${employeeId}`).set(HR).send({ salary: '25000000' }).expect(200);
    const logs = await http.get(`/api/v1/audit-logs?entity=employee&entityId=${employeeId}`).set(HR);
    const update = logs.body.items.find((l: any) => l.action === 'UPDATE' && 'salary' in (l.changedFields ?? {}));
    expect(update.changedFields.salary).toBe('***');
  });

  it('cây tổ chức có 1 gốc (Ban Giám đốc) và đủ 25 phòng ban', async () => {
    const tree = (await http.get('/api/v1/departments/tree').set(EMPLOYEE).expect(200)).body;
    const roots = tree.filter((n: any) => !n.code.startsWith('T-')); // bỏ phòng ban do test tạo
    expect(roots).toHaveLength(1);
    expect(roots[0].code).toBe('BOD');
    const flat = (await http.get('/api/v1/departments').set(EMPLOYEE)).body;
    expect(flat.length).toBeGreaterThanOrEqual(25); // test khác có thể tạo thêm phòng ban
  });

  it('thành viên phòng ban và nhân viên trực thuộc', async () => {
    const me = (await http.get('/api/v1/me').set(EMPLOYEE)).body.employee;
    const members = await http.get(`/api/v1/departments/${me.departmentId}/members?size=5`).set(EMPLOYEE).expect(200);
    expect(members.body.total).toBeGreaterThan(5);
    const reports = await http.get(`/api/v1/employees/${managerId}/direct-reports`).set(EMPLOYEE).expect(200);
    expect(reports.body.map((r: any) => r.id)).toContain(employeeId);
  });

  it('nhân viên không tạo được phòng ban; HR tạo được', async () => {
    const bod = (await http.get('/api/v1/departments').set(EMPLOYEE)).body.find((d: any) => d.code === 'BOD');
    const dto = { code: `T-${Date.now() % 100000}`, name: 'Phòng test', office: 'Hà Nội', parentId: bod.id };
    await http.post('/api/v1/departments').set(EMPLOYEE).send(dto).expect(403);
    await http.post('/api/v1/departments').set(HR).send(dto).expect(201);
  });

  it('số dư phép của tôi', async () => {
    const res = await http.get('/api/v1/leave-balances/me').set(EMPLOYEE).expect(200);
    expect(res.body.map((b: any) => b.leaveType).sort()).toEqual(['ANNUAL', 'SICK']);
  });

  describe('workflow nghỉ phép', () => {
    let ds: import('typeorm').DataSource;
    let savedBalances: { leave_type_id: string; used: string }[];
    const key = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const annual = async () =>
      (await http.get('/api/v1/leave-balances/me').set(EMPLOYEE)).body.find((b: any) => b.leaveType === 'ANNUAL');
    const create = (body: object, k = key()) =>
      http.post('/api/v1/leave-requests').set(EMPLOYEE).set('Idempotency-Key', k).send(body);
    const clean = async () => {
      await ds.query(
        `DELETE FROM leave.leave_request_history WHERE request_id IN (SELECT id FROM leave.leave_request WHERE employee_id = $1)`,
        [employeeId],
      );
      await ds.query('DELETE FROM leave.leave_request WHERE employee_id = $1', [employeeId]);
    };

    // Dọn đơn của nhân viên demo và đưa số dư về 0 ngày đã dùng để test chạy lại được; afterAll trả lại số liệu seed.
    beforeAll(async () => {
      const { DataSource } = await import('typeorm');
      ds = app.get(DataSource);
      savedBalances = await ds.query('SELECT leave_type_id, used FROM leave.leave_balance WHERE employee_id = $1', [employeeId]);
      await clean();
      await ds.query('UPDATE leave.leave_balance SET used = 0, pending = 0 WHERE employee_id = $1', [employeeId]);
    });

    afterAll(async () => {
      await clean();
      for (const b of savedBalances) {
        await ds.query(
          'UPDATE leave.leave_balance SET used = $3, pending = 0 WHERE employee_id = $1 AND leave_type_id = $2',
          [employeeId, b.leave_type_id, b.used],
        );
      }
    });

    it('tạo → quản lý duyệt → HR hoàn tất; số dư, lịch sử và audit đúng', async () => {
      const before = await annual();
      const k = key();
      const body = { leaveType: 'ANNUAL', startDate: '2026-11-09', endDate: '2026-11-10', reason: 'Việc gia đình' };
      const created = await create(body, k).expect(201);
      expect(created.body).toMatchObject({ status: 'SUBMITTED', days: 2, approverId: null });
      expect((await annual()).pending).toBe(before.pending + 2);

      // Idempotency-Key: gửi lại cùng nội dung trả về đơn cũ; khác nội dung thì 409.
      expect((await create(body, k).expect(201)).body.id).toBe(created.body.id);
      await create({ ...body, endDate: '2026-11-11' }, k).expect(409);

      const id = created.body.id;
      const v = created.body.version;
      await http.post(`/api/v1/leave-requests/${id}/approve`).set(EMPLOYEE).send({ version: v }).expect(403);
      await http.post(`/api/v1/leave-requests/${id}/approve`).set(HR).send({ version: v }).expect(403);
      await http.post(`/api/v1/leave-requests/${id}/approve`).set(MANAGER).send({ version: v + 5 }).expect(409);

      const queue = await http.get('/api/v1/leave-requests/pending-approval').set(MANAGER).expect(200);
      expect(queue.body.items.map((r: any) => r.id)).toContain(id);

      const approved = await http.post(`/api/v1/leave-requests/${id}/approve`).set(MANAGER).send({ version: v }).expect(200);
      expect(approved.body).toMatchObject({ status: 'APPROVED', approverId: managerId });
      // BR-11: duyệt lặp không đổi gì; quyết định ngược lại bị chặn; nhân viên không tự hủy đơn đã duyệt (BR-08).
      const again = await http.post(`/api/v1/leave-requests/${id}/approve`).set(MANAGER).send({ version: v }).expect(200);
      expect(again.body.version).toBe(approved.body.version);
      await http.post(`/api/v1/leave-requests/${id}/reject`).set(MANAGER).send({ version: approved.body.version }).expect(409);
      await http.post(`/api/v1/leave-requests/${id}/cancel`).set(EMPLOYEE).send({ version: approved.body.version }).expect(409);

      const hrQueue = await http.get('/api/v1/leave-requests').set(HR).expect(200);
      expect(hrQueue.body.items.map((r: any) => r.id)).toContain(id);
      await http.get('/api/v1/leave-requests').set(EMPLOYEE).expect(403);

      const done = await http
        .post(`/api/v1/leave-requests/${id}/complete`)
        .set(HR)
        .send({ version: approved.body.version })
        .expect(200);
      expect(done.body.status).toBe('COMPLETED');
      expect(done.body.history.map((h: any) => h.toStatus)).toEqual(['SUBMITTED', 'APPROVED', 'COMPLETED']);
      const after = await annual();
      expect(after.pending).toBe(before.pending);
      expect(after.used).toBe(before.used + 2);

      const logs = await http.get(`/api/v1/audit-logs?entity=leave_request&entityId=${id}`).set(HR).expect(200);
      expect(logs.body.items.map((l: any) => l.action).sort()).toEqual(['LEAVE_APPROVE', 'LEAVE_COMPLETE', 'LEAVE_SUBMIT']);
    });

    it('quản lý từ chối trả lại số ngày đang giữ (BR-09)', async () => {
      const before = await annual();
      const r = (await create({ leaveType: 'ANNUAL', startDate: '2026-11-11', endDate: '2026-11-11' }).expect(201)).body;
      const rejected = await http
        .post(`/api/v1/leave-requests/${r.id}/reject`)
        .set(MANAGER)
        .send({ version: r.version, comment: 'Trùng lịch dự án' })
        .expect(200);
      expect(rejected.body.status).toBe('REJECTED');
      expect(rejected.body.history[1]).toMatchObject({ toStatus: 'REJECTED', comment: 'Trùng lịch dự án' });
      expect(await annual()).toMatchObject({ pending: before.pending, used: before.used });
    });

    it('trùng lịch bị chặn; hai nửa ngày khác buổi thì được; hủy trả lại số dư (BR-02, BR-04, BR-07)', async () => {
      const before = await annual();
      const am = (await create({ leaveType: 'ANNUAL', startDate: '2026-11-16', endDate: '2026-11-16', halfDay: 'AM' }).expect(201)).body;
      expect(am.days).toBe(0.5);
      const pm = (await create({ leaveType: 'ANNUAL', startDate: '2026-11-16', endDate: '2026-11-16', halfDay: 'PM' }).expect(201)).body;
      await create({ leaveType: 'ANNUAL', startDate: '2026-11-13', endDate: '2026-11-16' }).expect(409);
      expect((await annual()).pending).toBe(before.pending + 1);

      await http.post(`/api/v1/leave-requests/${am.id}/cancel`).set(MANAGER).send({ version: am.version }).expect(403);
      for (const r of [am, pm]) {
        const res = await http.post(`/api/v1/leave-requests/${r.id}/cancel`).set(EMPLOYEE).send({ version: r.version }).expect(200);
        expect(res.body.status).toBe('CANCELLED');
      }
      expect((await annual()).pending).toBe(before.pending);
      const mine = await http.get('/api/v1/leave-requests/me?status=CANCELLED').set(EMPLOYEE).expect(200);
      expect(mine.body.total).toBe(2);
    });

    it('ngày lễ không trừ phép: 29/4–4/5/2026 tính 2 ngày, chỉ ngày nghỉ bù 27/4 bị từ chối (BR-03)', async () => {
      const r = await create({ leaveType: 'ANNUAL', startDate: '2026-04-29', endDate: '2026-05-04' }).expect(201);
      expect(r.body.days).toBe(2);
      await http.post(`/api/v1/leave-requests/${r.body.id}/cancel`).set(EMPLOYEE).send({ version: r.body.version }).expect(200);
      await create({ leaveType: 'ANNUAL', startDate: '2026-04-27', endDate: '2026-04-27' }).expect(400);
      await create({ leaveType: 'ANNUAL', startDate: '2026-11-14', endDate: '2026-11-15' }).expect(400); // T7, CN
    });

    it('không đủ số dư, dữ liệu sai hoặc thiếu Idempotency-Key → 400 (BR-01)', async () => {
      await create({ leaveType: 'ANNUAL', startDate: '2026-12-01', endDate: '2026-12-31' }).expect(400);
      await create({ leaveType: 'ANNUAL', startDate: '2026-12-01', endDate: '2026-11-30' }).expect(400);
      await create({ leaveType: 'ANNUAL', startDate: '2026-12-01', endDate: '2026-12-02', halfDay: 'AM' }).expect(400);
      await create({ leaveType: 'KHONG_CO', startDate: '2026-12-01', endDate: '2026-12-01' }).expect(400);
      await http
        .post('/api/v1/leave-requests')
        .set(EMPLOYEE)
        .send({ leaveType: 'ANNUAL', startDate: '2026-12-01', endDate: '2026-12-01' })
        .expect(400);
    });

    it('người ngoài không xem được đơn của nhân viên', async () => {
      const r = (await create({ leaveType: 'ANNUAL', startDate: '2026-12-07', endDate: '2026-12-07' }).expect(201)).body;
      await http.get(`/api/v1/leave-requests/${r.id}`).set(ADMIN).expect(403);
      await http.get(`/api/v1/leave-requests/${r.id}`).set(MANAGER).expect(200);
      await http.post(`/api/v1/leave-requests/${r.id}/cancel`).set(EMPLOYEE).send({ version: r.version }).expect(200);
    });

    it('danh sách ngày lễ 2026', async () => {
      const res = await http.get('/api/v1/leave-holidays?year=2026').set(EMPLOYEE).expect(200);
      expect(res.body.map((h: any) => h.date)).toContain('2026-11-24');
    });
  });

  it('audit_log là append-only ở mức database', async () => {
    const { DataSource } = await import('typeorm');
    const ds = app.get(DataSource);
    await expect(ds.query('DELETE FROM audit.audit_log')).rejects.toThrow(/append-only/);
  });
});
