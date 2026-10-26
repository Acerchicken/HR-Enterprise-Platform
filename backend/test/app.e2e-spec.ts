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

  it('audit_log là append-only ở mức database', async () => {
    const { DataSource } = await import('typeorm');
    const ds = app.get(DataSource);
    await expect(ds.query('DELETE FROM audit.audit_log')).rejects.toThrow(/append-only/);
  });
});
