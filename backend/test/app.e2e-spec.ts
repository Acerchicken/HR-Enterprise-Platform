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

describe('HRHelper API (e2e)', () => {
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

  // L-01 (biên bản tuần 8): dọn phòng ban do test tạo (mã T-...) để không lẫn vào dữ liệu demo.
  afterAll(async () => {
    const { DataSource } = await import('typeorm');
    await app.get(DataSource).query(`DELETE FROM org.department WHERE code LIKE 'T-%'`);
    await app.close();
  });

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

  describe('UC1 trang hồ sơ theo mục (AC-1.8.x, AC-1.3.5)', () => {
    const personalKeys = ['dateOfBirth', 'address', 'hireDate', 'status', 'version'];

    it('/me chỉ có tài khoản, vai trò, mã và tên hồ sơ (AC-1.8.7)', async () => {
      const me = (await http.get('/api/v1/me').set(EMPLOYEE).expect(200)).body;
      expect(Object.keys(me.employee).sort()).toEqual(['employeeCode', 'fullName', 'id']);
    });

    it('summary mức danh bạ: không có trường cá nhân, không có mục nào (AC-1.8.4, AC-1.8.7)', async () => {
      const s = (await http.get(`/api/v1/employees/${strangerId}/summary`).set(EMPLOYEE).expect(200)).body;
      expect(s).toMatchObject({ relation: 'OTHER', canEdit: false, sections: [] });
      expect(s.workEmail).toBeDefined();
      expect(s).not.toHaveProperty('contractType');
      for (const k of personalKeys) expect(s).not.toHaveProperty(k);
      expect(JSON.stringify(s).length).toBeLessThan(4096);
    });

    it('summary: quản lý thấy mục mức QL, chủ hồ sơ và HR thấy mọi mục; mục chưa làm có available=false', async () => {
      const asManager = (await http.get(`/api/v1/employees/${employeeId}/summary`).set(MANAGER).expect(200)).body;
      expect(asManager.relation).toBe('MANAGER');
      expect(asManager.contractType).toBeNull();
      expect(asManager.sections.map((x: any) => x.code)).not.toContain('salary');
      const asOwner = (await http.get(`/api/v1/employees/${employeeId}/summary`).set(EMPLOYEE).expect(200)).body;
      expect(asOwner.relation).toBe('OWNER');
      expect(asOwner.sections.find((x: any) => x.code === 'salary')).toMatchObject({ available: true, group: 'finance' });
      expect(asOwner.sections.find((x: any) => x.code === 'social-insurance')).toMatchObject({ available: false });
      for (const k of personalKeys) expect(asOwner).not.toHaveProperty(k);
      const asHr = (await http.get(`/api/v1/employees/${employeeId}/summary`).set(HR).expect(200)).body;
      expect(asHr).toMatchObject({ relation: 'HR', canEdit: true });
      expect(asHr.sections).toHaveLength(asOwner.sections.length);
    });

    it('mục không được xem, chưa làm hoặc không tồn tại đều trả 404 (AC-1.8.6)', async () => {
      await http.get(`/api/v1/employees/${strangerId}/profile/personal`).set(EMPLOYEE).expect(404);
      await http.get(`/api/v1/employees/${employeeId}/profile/salary`).set(MANAGER).expect(404);
      await http.get(`/api/v1/employees/${employeeId}/profile/social-insurance`).set(EMPLOYEE).expect(404);
      await http.get(`/api/v1/employees/${employeeId}/profile/nope`).set(HR).expect(404);
      await http.get(`/api/v1/employees/${employeeId}/profile/personal`).set(ADMIN).expect(404);
    });

    it('mục cá nhân: quản lý thấy ngày sinh, địa chỉ; chỉ HR có CCCD đã che', async () => {
      const asManager = (await http.get(`/api/v1/employees/${employeeId}/profile/personal`).set(MANAGER).expect(200)).body;
      expect(asManager).toMatchObject({ section: 'personal' });
      expect(asManager).toHaveProperty('dateOfBirth');
      expect(asManager).not.toHaveProperty('nationalId');
      const asHr = (await http.get(`/api/v1/employees/${employeeId}/profile/personal`).set(HR).expect(200)).body;
      expect(asHr.nationalId).toEqual({ hasValue: true, value: null });
      await http.get(`/api/v1/employees/${employeeId}/profile/personal?reveal=true`).set(EMPLOYEE).expect(403);
    });

    it('chủ hồ sơ bấm mắt xem lương của mình: có giá trị và audit VIEW_SENSITIVE (AC-1.3.5)', async () => {
      const masked = (await http.get(`/api/v1/employees/${employeeId}/profile/salary`).set(EMPLOYEE).expect(200)).body;
      expect(masked.salary.value).toBeNull();
      const shown = (await http.get(`/api/v1/employees/${employeeId}/profile/salary?reveal=true`).set(EMPLOYEE).expect(200)).body;
      expect(shown.salary.value).toMatch(/^[0-9]+$/);
      const logs = await http.get(`/api/v1/audit-logs?entity=employee&entityId=${employeeId}`).set(HR).expect(200);
      expect(logs.body.items[0]).toMatchObject({ action: 'VIEW_SENSITIVE', actorId: employeeId });
      expect(JSON.stringify(logs.body.items[0])).not.toContain(shown.salary.value);
      const bank = (await http.get(`/api/v1/employees/${employeeId}/profile/bank-account?reveal=true`).set(EMPLOYEE).expect(200)).body;
      expect(bank.bankAccount.value).toMatch(/^[0-9]{6,20}$/);
    });
  });

  it('nhân viên không xem được audit log', async () => {
    await http.get('/api/v1/audit-logs').set(EMPLOYEE).expect(403);
  });

  it('nhân viên tự sửa số điện thoại; không sửa được lương hay hồ sơ người khác', async () => {
    const me = (await http.get(`/api/v1/employees/${employeeId}/profile/personal`).set(EMPLOYEE)).body;
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
    const me = (await http.get(`/api/v1/employees/${employeeId}/summary`).set(EMPLOYEE)).body;
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

  /**
   * Ma trận phân quyền (docs/security/access-control-matrix.md): mỗi dòng có ít nhất một ca được phép và một ca bị chặn.
   * Các dòng đã được kiểm ở test khác trong file này thì không lặp lại.
   */
  describe('ma trận phân quyền', () => {
    const code = () => `T-${Date.now() % 1000000}${Math.floor(Math.random() * 10)}`;

    it('audit log: HR, ADMIN xem được; MANAGER bị chặn', async () => {
      await http.get('/api/v1/audit-logs?size=1').set(ADMIN).expect(200);
      await http.get('/api/v1/audit-logs?size=1').set(HR).expect(200);
      await http.get('/api/v1/audit-logs').set(MANAGER).expect(403);
    });

    it('đọc tổ chức, chức danh, loại phép, ngày lễ: mọi role đã đăng nhập, chưa đăng nhập thì 401', async () => {
      const dept = (await http.get('/api/v1/departments').set(ADMIN).expect(200)).body[0];
      for (const who of [EMPLOYEE, MANAGER, HR, ADMIN]) {
        await http.get(`/api/v1/departments/${dept.id}`).set(who).expect(200);
        await http.get('/api/v1/positions').set(who).expect(200);
        await http.get('/api/v1/leave-types').set(who).expect(200);
        await http.get('/api/v1/leave-holidays').set(who).expect(200);
      }
      await http.get('/api/v1/positions').expect(401);
      await http.get('/api/v1/leave-types').expect(401);
    });

    it('tạo, sửa phòng ban: HR và ADMIN; EMPLOYEE, MANAGER bị chặn; không tạo được vòng lặp', async () => {
      const bod = (await http.get('/api/v1/departments').set(HR)).body.find((d: any) => d.code === 'BOD');
      const dept = (name: string, parentId: string) => ({ code: code(), name, office: 'Hà Nội', parentId });
      const a = (await http.post('/api/v1/departments').set(ADMIN).send(dept('Phòng test A', bod.id)).expect(201)).body;
      await http.post('/api/v1/departments').set(MANAGER).send(dept('Phòng test', bod.id)).expect(403);
      const b = (await http.post('/api/v1/departments').set(HR).send(dept('Phòng test B', a.id)).expect(201)).body;

      await http.patch(`/api/v1/departments/${a.id}`).set(EMPLOYEE).send({ name: 'Đổi tên' }).expect(403);
      await http.patch(`/api/v1/departments/${a.id}`).set(MANAGER).send({ name: 'Đổi tên' }).expect(403);
      await http.patch(`/api/v1/departments/${a.id}`).set(HR).send({ name: 'Phòng test A1' }).expect(200);
      await http.patch(`/api/v1/departments/${a.id}`).set(ADMIN).send({ office: 'Đà Nẵng' }).expect(200);
      await http.patch(`/api/v1/departments/${a.id}`).set(HR).send({ parentId: b.id }).expect(400);
    });

    it('tạo nhân viên: chỉ HR (HR qua được phân quyền, dữ liệu thiếu thì 400)', async () => {
      for (const who of [EMPLOYEE, MANAGER, ADMIN]) {
        await http.post('/api/v1/employees').set(who).send({}).expect(403);
      }
      await http.post('/api/v1/employees').set(HR).send({}).expect(400);
    });

    it('HR tạo nhân viên kèm quản lý và trường nhạy cảm: 201, audit chỉ ghi tên trường nhạy cảm (FR-1.5)', async () => {
      const dept = (await http.get('/api/v1/departments').set(HR)).body.find((d: any) => d.code !== 'BOD');
      const pos = (await http.get('/api/v1/positions').set(HR)).body.find((p: any) => p.code !== 'CEO');
      const code = `E9${String(Date.now() % 10000).padStart(4, '0')}`;
      const res = await http
        .post('/api/v1/employees')
        .set(HR)
        .send({
          employeeCode: code,
          fullName: 'Nhân Viên Mới',
          workEmail: `new-${code.toLowerCase()}@hr.local`,
          departmentId: dept.id,
          positionId: pos.id,
          managerId,
          hireDate: '2026-11-12',
          dateOfBirth: '1998-05-20',
          nationalId: '079098000123',
          salary: '18000000',
        })
        .expect(201);
      expect(res.body).toMatchObject({ employeeCode: code, positionId: pos.id, managerId });
      const sensitive = await http.get(`/api/v1/employees/${res.body.id}?include=sensitive`).set(HR).expect(200);
      expect(sensitive.body.sensitive).toMatchObject({ nationalId: '079098000123', salary: '18000000', bankAccount: null });
      const logs = await http.get(`/api/v1/audit-logs?entity=employee&entityId=${res.body.id}`).set(HR).expect(200);
      const created = logs.body.items.find((l: any) => l.action === 'CREATE');
      expect(created.changedFields).toMatchObject({ nationalId: '***', salary: '***' });
      expect(JSON.stringify(created.changedFields)).not.toContain('079098000123');
      const { DataSource } = await import('typeorm');
      const ds = app.get(DataSource);
      await ds.query('DELETE FROM employee.employee_sensitive WHERE employee_id = $1', [res.body.id]);
      await ds.query('DELETE FROM iam.user_account WHERE employee_id = $1', [res.body.id]).catch(() => undefined);
      await ds.query('DELETE FROM employee.employee WHERE id = $1', [res.body.id]);
    });

    it('lỗi validation trả thêm fields theo từng trường', async () => {
      const res = await http.patch(`/api/v1/employees/${employeeId}`).set(EMPLOYEE).send({ phone: 'abc' }).expect(400);
      expect(res.body.fields).toEqual({ phone: 'Số điện thoại không hợp lệ' });
      expect(res.body.message).toEqual(['Số điện thoại không hợp lệ']);
    });

    it('xem hồ sơ: chủ hồ sơ PERSONAL, HR mức HR, ADMIN chỉ mức danh bạ; nhân viên không xem trường nhạy cảm', async () => {
      expect((await http.get(`/api/v1/employees/${employeeId}`).set(EMPLOYEE).expect(200)).body.visibility).toBe('PERSONAL');
      expect((await http.get(`/api/v1/employees/${employeeId}`).set(HR).expect(200)).body.visibility).toBe('HR');
      const asAdmin = (await http.get(`/api/v1/employees/${employeeId}`).set(ADMIN).expect(200)).body;
      expect(asAdmin.visibility).toBe('PUBLIC');
      expect(asAdmin.dateOfBirth).toBeUndefined();
      await http.get(`/api/v1/employees/${employeeId}?include=sensitive`).set(EMPLOYEE).expect(403);
    });

    it('sửa hồ sơ: quản lý không sửa hồ sơ cấp dưới; ADMIN không sửa hồ sơ người khác hay trường nhạy cảm', async () => {
      await http.patch(`/api/v1/employees/${employeeId}`).set(MANAGER).send({ phone: '0912000444' }).expect(403);
      await http.patch(`/api/v1/employees/${employeeId}`).set(MANAGER).send({ nationalId: '001234567890' }).expect(403);
      await http.patch(`/api/v1/employees/${employeeId}`).set(ADMIN).send({ phone: '0912000555' }).expect(403);
      await http.patch(`/api/v1/employees/${employeeId}`).set(ADMIN).send({ salary: '1000' }).expect(403);
    });

    it('/me và số dư phép của tôi: mọi role, chưa đăng nhập thì 401', async () => {
      expect((await http.get('/api/v1/me').set(ADMIN).expect(200)).body.roles).toContain('ADMIN');
      expect((await http.get('/api/v1/leave-balances/me').set(MANAGER).expect(200)).body.length).toBeGreaterThan(0);
      await http.get('/api/v1/leave-balances/me').expect(401);
    });

    it('danh sách đơn: chờ duyệt cho MANAGER và HR (đơn của CEO); toàn hệ thống chỉ HR', async () => {
      await http.get('/api/v1/leave-requests/pending-approval').set(MANAGER).expect(200);
      await http.get('/api/v1/leave-requests/pending-approval').set(HR).expect(200);
      for (const who of [EMPLOYEE, ADMIN]) {
        await http.get('/api/v1/leave-requests/pending-approval').set(who).expect(403);
      }
      await http.get('/api/v1/leave-requests').set(HR).expect(200);
      for (const who of [MANAGER, ADMIN]) {
        await http.get('/api/v1/leave-requests').set(who).expect(403);
      }
    });
  });

  it('số dư phép của tôi', async () => {
    const res = await http.get('/api/v1/leave-balances/me').set(EMPLOYEE).expect(200);
    expect(res.body.map((b: any) => b.leaveType).sort()).toEqual(['ANNUAL', 'SICK']);
  });

  /** Issue #22 (FR-2.5, FR-4.4): một quản lý cho mỗi nhân viên trừ CEO; HR duyệt đơn của CEO. */
  describe('quản lý trực tiếp và CEO', () => {
    let ds: import('typeorm').DataSource;
    let ceo: { id: string; email: string; positionId: string };
    let terminatedId: string;

    beforeAll(async () => {
      const { DataSource } = await import('typeorm');
      ds = app.get(DataSource);
      [ceo] = await ds.query(
        `SELECT e.id, e.work_email AS email, e.position_id AS "positionId" FROM employee.employee e
         JOIN org.position p ON p.id = e.position_id WHERE p.code = 'CEO' AND e.status <> 'TERMINATED'`,
      );
      [{ id: terminatedId }] = await ds.query(`SELECT id FROM employee.employee WHERE status = 'TERMINATED' LIMIT 1`);
    });

    it('tạo nhân viên không phải CEO mà thiếu quản lý → 400; tạo CEO thứ hai → 400', async () => {
      const dept = (await http.get('/api/v1/departments').set(HR)).body.find((d: any) => d.code !== 'BOD');
      const positions = (await http.get('/api/v1/positions').set(HR)).body;
      const staff = positions.find((p: any) => p.code !== 'CEO');
      const base = { fullName: 'Kiểm Thử Quản Lý', departmentId: dept.id, hireDate: '2026-11-01' };
      const res = await http
        .post('/api/v1/employees')
        .set(HR)
        .send({ ...base, employeeCode: 'E99001', workEmail: 'no-manager@hr.local', positionId: staff.id })
        .expect(400);
      expect(res.body.message).toMatch(/quản lý trực tiếp/);
      await http
        .post('/api/v1/employees')
        .set(HR)
        .send({ ...base, employeeCode: 'E99002', workEmail: 'second-ceo@hr.local', positionId: ceo.positionId })
        .expect(400);
    });

    it('gán quản lý đã nghỉ việc → 400; gán quản lý cho CEO → 400; bỏ quản lý của nhân viên → 400', async () => {
      await http.patch(`/api/v1/employees/${employeeId}`).set(HR).send({ managerId: terminatedId }).expect(400);
      await http.patch(`/api/v1/employees/${ceo.id}`).set(HR).send({ managerId: managerId }).expect(400);
      await http.patch(`/api/v1/employees/${employeeId}`).set(HR).send({ managerId: null }).expect(400);
    });

    it('HR duyệt đơn của CEO; quản lý khác không duyệt được; HR thấy đơn CEO trong danh sách chờ duyệt', async () => {
      const CEO = as(ceo.email);
      const created = await http
        .post('/api/v1/leave-requests')
        .set(CEO)
        .set('Idempotency-Key', `ceo-${Date.now()}`)
        .send({ leaveType: 'ANNUAL', startDate: '2026-12-28', endDate: '2026-12-28' })
        .expect(201);
      const r = created.body;
      try {
        const queue = await http.get('/api/v1/leave-requests/pending-approval').set(HR).expect(200);
        expect(queue.body.items.map((x: any) => x.id)).toContain(r.id);
        expect((await http.get(`/api/v1/leave-requests/${r.id}`).set(HR).expect(200)).body.canDecide).toBe(true);
        await http.post(`/api/v1/leave-requests/${r.id}/approve`).set(MANAGER).send({ version: r.version }).expect(403);
        const ok = await http.post(`/api/v1/leave-requests/${r.id}/approve`).set(HR).send({ version: r.version }).expect(200);
        expect(ok.body.status).toBe('APPROVED');
      } finally {
        await ds.query('DELETE FROM leave.leave_request_history WHERE request_id = $1', [r.id]);
        await ds.query('DELETE FROM leave.outbox WHERE aggregate_id = $1', [r.id]);
        await ds.query('DELETE FROM leave.leave_request WHERE id = $1', [r.id]);
        await ds.query(
          `UPDATE leave.leave_balance SET pending = GREATEST(pending - 1, 0)
           WHERE employee_id = $1 AND leave_type_id = (SELECT id FROM leave.leave_type WHERE code = 'ANNUAL') AND year = 2026`,
          [ceo.id],
        );
      }
    });

    it('HR không duyệt được đơn của nhân viên khác CEO; người duyệt thấy canDecide', async () => {
      const r = (
        await http
          .post('/api/v1/leave-requests')
          .set(EMPLOYEE)
          .set('Idempotency-Key', `nonceo-${Date.now()}`)
          .send({ leaveType: 'ANNUAL', startDate: '2026-12-29', endDate: '2026-12-29' })
          .expect(201)
      ).body;
      expect((await http.get(`/api/v1/leave-requests/${r.id}`).set(HR).expect(200)).body.canDecide).toBe(false);
      expect((await http.get(`/api/v1/leave-requests/${r.id}`).set(MANAGER).expect(200)).body.canDecide).toBe(true);
      await http.post(`/api/v1/leave-requests/${r.id}/approve`).set(HR).send({ version: r.version }).expect(403);
      await http.post(`/api/v1/leave-requests/${r.id}/cancel`).set(EMPLOYEE).send({ version: r.version }).expect(200);
    });
  });

  /**
   * Kho tài liệu (UC5, document-rules.md). Cần object storage S3 (MinIO/S3Mock): đặt STORAGE_BUCKET, STORAGE_ENDPOINT…;
   * không có thì bỏ qua nhóm này.
   */
  (process.env.STORAGE_BUCKET ? describe : describe.skip)('kho tài liệu', () => {
    let ds: import('typeorm').DataSource;
    let me: any;
    const pdf = (text: string) => Buffer.from(`%PDF-1.4\n${text}\n%%EOF\n`, 'latin1');
    const zip = Buffer.from('PK\x03\x04....photos/1.jpg.....', 'latin1');

    /** HR khai báo file, PUT lên presigned URL như trình duyệt, rồi xác nhận. */
    const publish = async (title: string, scope: object, file = pdf(title), fileName = 'tai-lieu.pdf') => {
      const created = await http
        .post('/api/v1/documents')
        .set(HR)
        .send({ title, type: 'POLICY', scope, fileName, contentType: fileName.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeBytes: file.length })
        .expect(201);
      const up = created.body.upload;
      const put = await fetch(up.url, { method: 'PUT', headers: up.headers, body: file });
      expect(put.ok).toBe(true);
      const confirmed = await http.post(`/api/v1/documents/${created.body.document.id}/versions/${up.versionId}/confirm`).set(HR);
      return { id: created.body.document.id as string, versionId: up.versionId as string, confirmed };
    };

    beforeAll(async () => {
      const { DataSource } = await import('typeorm');
      ds = app.get(DataSource);
      me = (await http.get(`/api/v1/employees/${employeeId}/summary`).set(EMPLOYEE)).body;
      // Storage test (MinIO/S3Mock mới dựng) có thể chưa có bucket.
      const { S3Client, CreateBucketCommand } = await import('@aws-sdk/client-s3');
      const s3 = new S3Client({
        region: process.env.STORAGE_REGION ?? 'ap-southeast-1',
        endpoint: process.env.STORAGE_ENDPOINT,
        forcePathStyle: true,
        credentials: { accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? 'x', secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? 'x' },
      });
      await s3.send(new CreateBucketCommand({ Bucket: process.env.STORAGE_BUCKET! })).catch(() => undefined);
    });

    afterAll(async () => {
      await ds.query(`DELETE FROM document.document WHERE title LIKE 'E2E %'`);
    });

    it('phạm vi phòng ban gồm phòng ban con; HR ngoài phạm vi không thấy; tải qua API đúng nội dung (DR-02, DR-03, DR-06)', async () => {
      const depts = (await http.get('/api/v1/departments').set(HR)).body;
      const parent = depts.find((d: any) => d.id === me.departmentId).parentId;
      const a = await publish('E2E Quy trình kỹ thuật', { departmentIds: [parent] });
      expect(a.confirmed.status).toBe(200);
      expect(a.confirmed.body.latest).toMatchObject({ versionNo: 1, status: 'READY' });

      const list = await http.get('/api/v1/documents?size=100').set(EMPLOYEE).expect(200);
      expect(list.body.items.map((d: any) => d.id)).toContain(a.id);
      const file = await http.get(`/api/v1/documents/${a.id}/download`).set(EMPLOYEE).buffer(true).parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      }).expect(200);
      expect(file.headers['content-type']).toBe('application/pdf');
      expect((file.body as Buffer).toString('latin1').startsWith('%PDF-1.4')).toBe(true);

      // HR không thuộc phạm vi: không thấy trong danh sách, không xem được, nhưng quản lý được metadata.
      expect((await http.get('/api/v1/documents?size=100').set(HR)).body.items.map((d: any) => d.id)).not.toContain(a.id);
      await http.get(`/api/v1/documents/${a.id}`).set(HR).expect(404);
      await http.get(`/api/v1/documents/${a.id}/download`).set(HR).expect(404);
      expect((await http.get(`/api/v1/documents/manage/${a.id}`).set(HR).expect(200)).body.scope.departmentIds).toEqual([parent]);
    });

    it('phạm vi theo vai trò; ngoài phạm vi trả 404 như không tồn tại; chỉ HR quản lý kho (DR-02, DR-03, DR-08)', async () => {
      const b = await publish('E2E Chỉ dành cho HR', { roles: ['HR'] });
      expect(b.confirmed.status).toBe(200);
      await http.get(`/api/v1/documents/${b.id}`).set(EMPLOYEE).expect(404);
      await http.get(`/api/v1/documents/00000000-0000-4000-8000-000000000000`).set(EMPLOYEE).expect(404);
      expect((await http.get(`/api/v1/documents/${b.id}`).set(HR).expect(200)).body.title).toBe('E2E Chỉ dành cho HR');
      for (const who of [EMPLOYEE, MANAGER, ADMIN]) {
        await http.post('/api/v1/documents').set(who).send({}).expect(403);
        await http.get('/api/v1/documents/manage').set(who).expect(403);
        await http.post(`/api/v1/documents/${b.id}/hide`).set(who).expect(403);
      }
    });

    it('phiên bản mới không ghi đè phiên bản cũ; mặc định tải bản mới nhất (DR-04)', async () => {
      const c = await publish('E2E Nội quy', { all: true }, pdf('ban 1'));
      const v2 = await http.post(`/api/v1/documents/${c.id}/versions`).set(HR)
        .send({ fileName: 'noi-quy-v2.pdf', contentType: 'application/pdf', sizeBytes: pdf('ban 2').length }).expect(201);
      await fetch(v2.body.url, { method: 'PUT', headers: v2.body.headers, body: pdf('ban 2') });
      await http.post(`/api/v1/documents/${c.id}/versions/${v2.body.versionId}/confirm`).set(HR).expect(200);

      const detail = (await http.get(`/api/v1/documents/${c.id}`).set(EMPLOYEE).expect(200)).body;
      expect(detail.versions.map((v: any) => v.versionNo)).toEqual([2, 1]);
      expect(detail.latest.versionNo).toBe(2);
      const latest = await http.get(`/api/v1/documents/${c.id}/download`).set(EMPLOYEE).expect(200);
      expect(latest.headers['content-disposition']).toContain('noi-quy-v2.pdf');
      const old = await http.get(`/api/v1/documents/${c.id}/versions/${c.versionId}/download`).set(EMPLOYEE).expect(200);
      expect(old.headers['content-disposition']).toContain('tai-lieu.pdf');
    });

    it('file sai định dạng hoặc chưa tải lên bị từ chối (DR-01)', async () => {
      const fake = await publish('E2E File ZIP đổi tên', { all: true }, zip, 'gia-mao.docx');
      expect(fake.confirmed.status).toBe(400);
      expect(fake.confirmed.body.message).toMatch(/định dạng/);
      expect((await http.get(`/api/v1/documents/${fake.id}`).set(EMPLOYEE)).status).toBe(404);

      const big = await http.post('/api/v1/documents').set(HR)
        .send({ title: 'E2E Quá lớn', type: 'FORM', scope: { all: true }, fileName: 'a.pdf', contentType: 'application/pdf', sizeBytes: 21 * 1024 * 1024 });
      expect(big.status).toBe(400);
      const noScope = await http.post('/api/v1/documents').set(HR)
        .send({ title: 'E2E Không phạm vi', type: 'FORM', scope: {}, fileName: 'a.pdf', contentType: 'application/pdf', sizeBytes: 100 });
      expect(noScope.status).toBe(400);

      const pending = await http.post('/api/v1/documents').set(HR)
        .send({ title: 'E2E Chưa tải', type: 'FORM', scope: { all: true }, fileName: 'a.pdf', contentType: 'application/pdf', sizeBytes: 100 }).expect(201);
      const r = await http.post(`/api/v1/documents/${pending.body.document.id}/versions/${pending.body.upload.versionId}/confirm`).set(HR);
      expect(r.status).toBe(400);
    });

    it('ẩn tài liệu thì không ai xem được, khôi phục thì xem lại được; đổi phòng ban mất quyền ngay (DR-05, DR-06)', async () => {
      const depts = (await http.get('/api/v1/departments').set(HR)).body;
      const d = await publish('E2E Theo phòng ban', { departmentIds: [me.departmentId] });
      await http.get(`/api/v1/documents/${d.id}`).set(EMPLOYEE).expect(200);

      const hidden = (await http.post(`/api/v1/documents/${d.id}/hide`).set(HR).expect(200)).body;
      expect(hidden.hidden).toBe(true);
      await http.get(`/api/v1/documents/${d.id}`).set(EMPLOYEE).expect(404);
      await http.get(`/api/v1/documents/${d.id}/download`).set(EMPLOYEE).expect(404);
      await http.post(`/api/v1/documents/${d.id}/restore`).set(HR).expect(200);
      await http.get(`/api/v1/documents/${d.id}`).set(EMPLOYEE).expect(200);

      const other = depts.find((x: any) => x.id !== me.departmentId && x.parentId !== me.departmentId && x.code !== 'BOD');
      const before = (await http.get(`/api/v1/employees/${me.id}`).set(HR)).body;
      await http.patch(`/api/v1/employees/${me.id}`).set(HR).send({ departmentId: other.id, version: before.version }).expect(200);
      try {
        await http.get(`/api/v1/documents/${d.id}`).set(EMPLOYEE).expect(404);
      } finally {
        const now = (await http.get(`/api/v1/employees/${me.id}`).set(HR)).body;
        await http.patch(`/api/v1/employees/${me.id}`).set(HR).send({ departmentId: me.departmentId, version: now.version }).expect(200);
      }
    });

    it('sửa metadata cần version đúng (optimistic locking)', async () => {
      const e = await publish('E2E Đổi tên', { all: true });
      const cur = (await http.get(`/api/v1/documents/manage/${e.id}`).set(HR)).body;
      await http.patch(`/api/v1/documents/${e.id}`).set(HR).send({ title: 'E2E Đã đổi tên', version: cur.version + 3 }).expect(409);
      const ok = await http.patch(`/api/v1/documents/${e.id}`).set(HR).send({ title: 'E2E Đã đổi tên', version: cur.version }).expect(200);
      expect(ok.body.title).toBe('E2E Đã đổi tên');
    });
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
      await ds.query(
        `DELETE FROM leave.outbox WHERE aggregate_id IN (SELECT id FROM leave.leave_request WHERE employee_id = $1)`,
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

      // Outbox: mỗi thao tác ghi đúng một event trong cùng transaction (lần gửi lặp không ghi thêm).
      const events = await ds.query('SELECT event_type, payload FROM leave.outbox WHERE aggregate_id = $1 ORDER BY id', [id]);
      expect(events.map((e: any) => e.event_type)).toEqual(['LeaveRequested', 'LeaveApproved', 'LeaveCompleted']);
      expect(events[0].payload).toMatchObject({ requestId: id, employeeId, leaveType: 'ANNUAL', days: 2 });
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

    it('trùng lịch với đơn đang chờ → 409 (TC-04, BR-02)', async () => {
      const r = (await create({ leaveType: 'ANNUAL', startDate: '2026-11-23', endDate: '2026-11-23' }).expect(201)).body;
      await create({ leaveType: 'ANNUAL', startDate: '2026-11-23', endDate: '2026-11-25' }).expect(409);
      await http.post(`/api/v1/leave-requests/${r.id}/cancel`).set(EMPLOYEE).send({ version: r.version }).expect(200);
    });

    it('HR hoàn tất đơn chưa duyệt → 409, đơn giữ SUBMITTED (TC-21, BR-10)', async () => {
      const r = (await create({ leaveType: 'ANNUAL', startDate: '2026-11-26', endDate: '2026-11-26' }).expect(201)).body;
      await http.post(`/api/v1/leave-requests/${r.id}/complete`).set(HR).send({ version: r.version }).expect(409);
      expect((await http.get(`/api/v1/leave-requests/${r.id}`).set(HR).expect(200)).body.status).toBe('SUBMITTED');
      await http.post(`/api/v1/leave-requests/${r.id}/cancel`).set(EMPLOYEE).send({ version: r.version }).expect(200);
    });

    it('chỉ quản lý trực tiếp duyệt/từ chối, chỉ HR hoàn tất, chỉ chủ đơn hủy (TC-22, BR-05, BR-07, BR-10)', async () => {
      const r = (await create({ leaveType: 'ANNUAL', startDate: '2026-11-27', endDate: '2026-11-27' }).expect(201)).body;
      for (const who of [EMPLOYEE, HR, ADMIN]) {
        await http.post(`/api/v1/leave-requests/${r.id}/reject`).set(who).send({ version: r.version }).expect(403);
      }
      await http.post(`/api/v1/leave-requests/${r.id}/cancel`).set(HR).send({ version: r.version }).expect(403);
      const ok = (await http.post(`/api/v1/leave-requests/${r.id}/approve`).set(MANAGER).send({ version: r.version }).expect(200)).body;
      for (const who of [EMPLOYEE, MANAGER, ADMIN]) {
        await http.post(`/api/v1/leave-requests/${r.id}/complete`).set(who).send({ version: ok.version }).expect(403);
      }
      expect((await http.get(`/api/v1/leave-requests/${r.id}`).set(EMPLOYEE).expect(200)).body.status).toBe('APPROVED');
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
