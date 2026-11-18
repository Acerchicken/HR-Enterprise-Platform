/**
 * E2E test chạy với database thật (đã migrate + seed) và AUTH_MODE=dev.
 *   npm run migration:run && npm run seed && npm run test:e2e
 */
process.env.AUTH_MODE = 'dev';
// Cả bộ e2e gọi API rất nhanh bằng vài tài khoản: nới giới hạn chung, giữ nguyên giới hạn hồ sơ để kiểm AC-1.14.x.
process.env.RATE_LIMIT_OVERRIDES = JSON.stringify({ global: { minute: 100000 }, 'profile-write': { minute: 100000 } });

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { loadConfig } from '../src/config/config';
import { ProfileStorage } from '../src/modules/employee/profile-file.service';
import { FakeBucket, sha256 } from './fake-storage';

/** Bucket hồ sơ giả trong bộ nhớ (máy chạy e2e không cần MinIO). */
const bucket = new FakeBucket();

const as = (email: string) => ({ Authorization: `Bearer dev:${email}` });
/** Version hiện tại của hồ sơ (PATCH bắt buộc gửi version, E9). */
let versionOf: (id: string) => Promise<number>;
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

  /** Điều chuyển hiệu lực hôm nay (UC2 FR-2.7), giữ nguyên cấp dưới nếu có. */
  const transfer = async (id: string, change: { departmentId?: string; positionId?: string; managerId?: string | null }, extra: object = {}) => {
    const e = (await http.get(`/api/v1/employees/${id}`).set(HR)).body;
    const reports = (await http.get(`/api/v1/employees/${id}/direct-reports`).set(HR)).body.map((r: any) => ({ employeeId: r.id, managerId: id }));
    const { vnToday } = await import('../src/modules/employee/transfer-rules');
    return http
      .post(`/api/v1/employees/${id}/transfers`)
      .set(HR)
      .send({ effectiveDate: vnToday(), departmentId: e.departmentId, positionId: e.positionId, managerId: e.managerId, reason: 'CORRECTION', reports, ...change, ...extra });
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(ProfileStorage).useValue(bucket).compile();
    app = mod.createNestApplication();
    configureApp(app, loadConfig());
    await app.init();
    http = request(app.getHttpServer());
    versionOf = async (id: string) => (await http.get(`/api/v1/employees/${id}`).set(HR)).body.version;
    // Bộ đếm theo ngày lưu trong DB: xóa để chạy lại e2e nhiều lần trong ngày không bị 429.
    await app.get((await import('typeorm')).DataSource).query('DELETE FROM iam.rate_limit_counter');

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
      expect(asOwner.sections.every((x: any) => x.available)).toBe(true);
      for (const k of personalKeys) expect(asOwner).not.toHaveProperty(k);
      const asHr = (await http.get(`/api/v1/employees/${employeeId}/summary`).set(HR).expect(200)).body;
      expect(asHr).toMatchObject({ relation: 'HR', canEdit: true });
      expect(asHr.sections).toHaveLength(asOwner.sections.length);
    });

    it('mục không được xem, chưa làm hoặc không tồn tại đều trả 404 (AC-1.8.6)', async () => {
      await http.get(`/api/v1/employees/${strangerId}/profile/personal`).set(EMPLOYEE).expect(404);
      await http.get(`/api/v1/employees/${employeeId}/profile/salary`).set(MANAGER).expect(404);
      await http.get(`/api/v1/employees/${employeeId}/profile/contracts`).set(MANAGER).expect(404);
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

    it('quản lý gián tiếp (quản lý của quản lý) xem mức QL như quản lý trực tiếp, không xem mức CN (chốt 18/11)', async () => {
      const mgr = (await http.get(`/api/v1/employees/${managerId}`).set(HR).expect(200)).body;
      expect(mgr.managerId).toBeTruthy();
      const skip = (await http.get(`/api/v1/employees/${mgr.managerId}`).set(HR).expect(200)).body;
      const SKIP = as(skip.workEmail);
      const s = (await http.get(`/api/v1/employees/${employeeId}/summary`).set(SKIP).expect(200)).body;
      expect(s.relation).toBe('MANAGER');
      expect(s.sections.map((x: any) => x.code)).toContain('career-history');
      expect((await http.get(`/api/v1/employees/${employeeId}/profile/personal`).set(SKIP).expect(200)).body).toHaveProperty('dateOfBirth');
      expect((await http.get(`/api/v1/employees/${employeeId}`).set(SKIP).expect(200)).body.visibility).toBe('PERSONAL');
      await http.get(`/api/v1/employees/${employeeId}/profile/salary`).set(SKIP).expect(404);
      // Chiều ngược lại (cấp dưới xem cấp trên) và người ngoài nhánh vẫn chỉ mức danh bạ.
      expect((await http.get(`/api/v1/employees/${mgr.managerId}/summary`).set(EMPLOYEE).expect(200)).body.relation).toBe('OTHER');
      expect((await http.get(`/api/v1/employees/${strangerId}/summary`).set(MANAGER).expect(200)).body.relation).not.toBe('MANAGER');
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
      expect(bank.rows[0].sensitive.accountNumber.value).toMatch(/^[0-9]{6,20}$/);
    });
  });

  describe('header bảo mật và giới hạn tần suất (NFR-5.21, NFR-5.22, AC-1.14.1, AC-1.14.6, AC-1.14.7)', () => {
    it('mọi response có header bảo mật', async () => {
      const res = await http.get('/api/v1/health').expect(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('body quá 64 KiB → 413', async () => {
      const res = await http
        .patch(`/api/v1/employees/${employeeId}`)
        .set(EMPLOYEE)
        .send({ address: 'x'.repeat(70 * 1024), version: 1 })
        .expect(413);
      expect(res.body.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('lượt tìm kiếm thứ 21 trong một phút → 429 kèm Retry-After, câu báo nêu giới hạn (NFR-5.21, AC-1.14.7)', async () => {
      // Tài khoản riêng (một đồng nghiệp bất kỳ) để không ảnh hưởng test khác. Giới hạn ghi hồ sơ có unit test riêng
      // (rate-limit.spec.ts); e2e nới giới hạn đó vì HR ghi rất nhiều lần trong bộ test.
      const other = (await http.get(`/api/v1/employees/${strangerId}`).set(HR)).body;
      const who = as(other.workEmail);
      for (let i = 0; i < 20; i++) await http.get('/api/v1/employees?q=ngu&size=1').set(who).expect(200);
      const res = await http.get('/api/v1/employees?q=ngu&size=1').set(who).expect(429);
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
      expect(res.body).toMatchObject({ code: 'TOO_MANY_REQUESTS' });
      expect(res.body.message).toMatch(/20 lượt tìm kiếm mỗi phút/);
    });
  });

  describe('header bảo mật và giới hạn tần suất (NFR-5.21, NFR-5.22, AC-1.14.1, AC-1.14.6, AC-1.14.7)', () => {
    it('mọi response có header bảo mật', async () => {
      const res = await http.get('/api/v1/health').expect(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('body quá 64 KiB → 413', async () => {
      const res = await http
        .patch(`/api/v1/employees/${employeeId}`)
        .set(EMPLOYEE)
        .send({ address: 'x'.repeat(70 * 1024), version: 1 })
        .expect(413);
      expect(res.body.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('lệnh ghi hồ sơ thứ 31 trong một phút → 429 kèm Retry-After, câu báo nêu giới hạn', async () => {
      // Tài khoản riêng (một đồng nghiệp bất kỳ) để không ảnh hưởng test khác.
      const other = (await http.get(`/api/v1/employees/${strangerId}`).set(HR)).body;
      const who = as(other.workEmail);
      for (let i = 0; i < 30; i++) {
        const r = await http.patch(`/api/v1/employees/${strangerId}`).set(who).send({ phone: '0912000999', version: -1 });
        expect(r.status).toBe(409);
      }
      const res = await http
        .patch(`/api/v1/employees/${strangerId}`)
        .set(who)
        .send({ phone: '0912000999', version: -1 })
        .expect(429);
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
      expect(res.body).toMatchObject({ code: 'TOO_MANY_REQUESTS' });
      expect(res.body.message).toMatch(/30 lệnh ghi hồ sơ mỗi phút/);
    });
  });

  it('nhân viên không xem được audit log', async () => {
    await http.get('/api/v1/audit-logs').set(EMPLOYEE).expect(403);
  });

  it('nhân viên không ghi thẳng hồ sơ, kể cả điện thoại: 403 (AC-1.2.1, AC-1.2.2, E1)', async () => {
    await http.patch(`/api/v1/employees/${employeeId}`).set(EMPLOYEE).send({ phone: '0912000111', version: 1 }).expect(403);
    await http.patch(`/api/v1/employees/${employeeId}`).set(EMPLOYEE).send({ salary: '999999999', version: 1 }).expect(403);
    await http.patch(`/api/v1/employees/${strangerId}`).set(EMPLOYEE).send({ phone: '0912000222', version: 1 }).expect(403);
  });

  it('version cũ → 409 (optimistic locking)', async () => {
    const res = await http.patch(`/api/v1/employees/${employeeId}`).set(HR).send({ phone: '0912000333', version: 1 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
  });

  it('dữ liệu sai → 400', async () => {
    await http.patch(`/api/v1/employees/${employeeId}`).set(EMPLOYEE).send({ phone: 'abc' }).expect(400);
    await http.patch(`/api/v1/employees/${employeeId}`).set(EMPLOYEE).send({ unknownField: 1 }).expect(400);
  });

  it('HR không gán được quản lý tạo vòng lặp', async () => {
    const res = await transfer(managerId, { managerId: employeeId });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/vòng/);
  });

  it('HR cập nhật lương: audit chỉ ghi tên trường, không ghi giá trị', async () => {
    const v2 = await versionOf(employeeId);
    await http.patch(`/api/v1/employees/${employeeId}`).set(HR).send({ salary: '25000000', version: v2 }).expect(200);
    const logs = await http.get(`/api/v1/audit-logs?entity=employee&entityId=${employeeId}`).set(HR);
    const update = logs.body.items.find((l: any) => l.action === 'UPDATE' && 'salary' in (l.changedFields ?? {}));
    expect(update.changedFields.salary).toBe('***');
  });

  describe('UC8 FR-8.7: ADMIN cấp, thu hồi vai trò (AC-8.7.x, ADR-18)', () => {
    const path = '/api/v1/admin/role-assignments';
    const db = () => app.get(require('typeorm').DataSource);
    const reason = 'Kiểm thử e2e cấp vai trò';
    let employeeAccount: string;
    let adminAccount: string;

    beforeAll(async () => {
      [{ id: employeeAccount }] = await db().query(`SELECT id FROM iam.user_account WHERE email = 'employee@hr.local'`);
      [{ id: adminAccount }] = await db().query(`SELECT id FROM iam.user_account WHERE email = 'admin@hr.local'`);
      await db().query(`DELETE FROM iam.role_assignment WHERE user_id = $1 AND role IN ('HR', 'ADMIN')`, [employeeAccount]);
    });

    it('chỉ ADMIN gọi được, kể cả HR bị 403 (AC-8.7.5)', async () => {
      await http.get(path).set(HR).expect(403);
      await http.get(path).set(EMPLOYEE).expect(403);
      await http.post(path).set(HR).send({ employeeId, role: 'HR', reason }).expect(403);
      const list = (await http.get(`${path}?role=ADMIN`).set(ADMIN).expect(200)).body;
      expect(list.items.map((r: any) => r.email)).toContain('admin@hr.local');
      expect(list.items.every((r: any) => r.role === 'ADMIN')).toBe(true);
    });

    it('cấp HR: có quyền ngay ở request kế tiếp, có người cấp, lý do, audit, event (AC-8.7.1)', async () => {
      await http.get('/api/v1/audit-logs').set(EMPLOYEE).expect(403);
      const row = (await http.post(path).set(ADMIN).send({ employeeId, role: 'HR', reason: `  ${reason}  ` }).expect(201)).body;
      expect(row).toMatchObject({ userId: employeeAccount, employeeId, role: 'HR', reason, grantedBy: { id: adminAccount } });
      expect((await http.get('/api/v1/me').set(EMPLOYEE)).body.roles).toContain('HR');
      await http.get('/api/v1/audit-logs').set(EMPLOYEE).expect(200);
      const [audit] = await db().query(
        `SELECT actor_id, changed_fields FROM audit.audit_log WHERE action = 'ROLE_GRANT' AND entity_id = $1 ORDER BY id DESC LIMIT 1`,
        [employeeAccount],
      );
      // audit.audit_log.actor_id là id hồ sơ nhân viên (như mọi audit khác), không phải id tài khoản.
      const adminEmployee = (await http.get('/api/v1/me').set(ADMIN)).body.employee.id;
      expect(audit).toMatchObject({ actor_id: adminEmployee, changed_fields: { role: 'HR', reason } });
      const [event] = await db().query(`SELECT payload FROM leave.outbox WHERE event_type = 'RoleGranted' AND aggregate_id = $1 ORDER BY id DESC LIMIT 1`, [employeeAccount]);
      expect(event.payload).toMatchObject({ accountId: employeeAccount, email: 'employee@hr.local', role: 'HR' });
      const found = (await http.get(`${path}?q=employee@hr`).set(ADMIN).expect(200)).body;
      expect(found.items).toEqual([expect.objectContaining({ userId: employeeAccount, role: 'HR' })]);
    });

    it('đã có vai trò → 409; lý do ngắn, vai trò MANAGER → 400 (AC-8.7.6, AC-8.7.7)', async () => {
      await http.post(path).set(ADMIN).send({ employeeId, role: 'HR', reason }).expect(409);
      expect((await http.post(path).set(ADMIN).send({ employeeId, role: 'HR', reason: ' ab ' }).expect(400)).body.fields).toHaveProperty('reason');
      await http.post(path).set(ADMIN).send({ employeeId, role: 'MANAGER', reason }).expect(400);
      const noAccount = (await db().query(
        `SELECT e.id FROM employee.employee e LEFT JOIN iam.user_account a ON a.employee_id = e.id WHERE a.id IS NULL AND e.status <> 'TERMINATED' LIMIT 1`,
      ))[0].id;
      await http.post(path).set(ADMIN).send({ employeeId: noAccount, role: 'HR', reason }).expect(400);
    });

    it('tự cấp cho mình → 403; ADMIN duy nhất tự thu hồi → 409 (AC-8.7.3, AC-8.7.4)', async () => {
      const adminEmployee = (await http.get('/api/v1/me').set(ADMIN)).body.employee.id;
      await http.post(path).set(ADMIN).send({ employeeId: adminEmployee, role: 'HR', reason }).expect(403);
      const [{ n }] = await db().query(`SELECT count(*)::int AS n FROM iam.role_assignment WHERE role = 'ADMIN'`);
      expect(n).toBe(1);
      const res = await http.delete(`${path}/${adminAccount}/ADMIN`).set(ADMIN).send({ reason }).expect(409);
      expect(res.body.message).toContain('ít nhất một ADMIN');
      await http.delete(`${path}/${adminAccount}/HR`).set(ADMIN).send({ reason }).expect(403);
    });

    it('thu hồi HR: mất quyền ở request kế tiếp, audit có lý do (AC-8.7.2)', async () => {
      await http.delete(`${path}/${employeeAccount}/HR`).set(ADMIN).send({ reason: 'ab' }).expect(400);
      await http.delete(`${path}/${employeeAccount}/HR`).set(ADMIN).send({ reason }).expect(204);
      await http.get('/api/v1/audit-logs').set(EMPLOYEE).expect(403);
      await http.delete(`${path}/${employeeAccount}/HR`).set(ADMIN).send({ reason }).expect(404);
      const [audit] = await db().query(`SELECT changed_fields FROM audit.audit_log WHERE action = 'ROLE_REVOKE' AND entity_id = $1 ORDER BY id DESC LIMIT 1`, [employeeAccount]);
      expect(audit.changed_fields).toMatchObject({ role: 'HR', reason });
    });
  });

  it('cây tổ chức có 1 gốc loại Công ty, mỗi đơn vị có loại, trưởng, số người (AC-2.2.1, AC-2.2.3)', async () => {
    const tree = (await http.get('/api/v1/departments/tree').set(EMPLOYEE).expect(200)).body;
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ code: 'HQ', unitType: 'COMPANY' });
    expect(tree[0].head?.fullName).toBeTruthy();
    const flatTree = (nodes: any[]): any[] => nodes.flatMap((n) => [n, ...flatTree(n.children)]);
    const nodes = flatTree(tree);
    const eng = nodes.find((n) => n.code === 'ENG');
    expect(eng).toMatchObject({ unitType: 'CENTER', parentId: tree[0].id });
    expect(nodes.find((n) => n.code === 'LEG')).toMatchObject({ unitType: 'DEPARTMENT', parentId: tree[0].id });
    expect(nodes.find((n) => n.code === 'ENG-WEB-BE')).toMatchObject({ unitType: 'TEAM' });
    expect(nodes.find((n) => n.code === 'ENG-WEB').memberCount).toBeGreaterThan(0);
    // Cây xếp trung tâm trước phòng đứng riêng.
    const types = tree[0].children.map((c: any) => c.unitType);
    expect(types.indexOf('DEPARTMENT')).toBeGreaterThan(types.lastIndexOf('CENTER'));
    const flat = (await http.get('/api/v1/departments').set(EMPLOYEE)).body;
    expect(flat.length).toBeGreaterThanOrEqual(28); // test khác có thể tạo thêm đơn vị
  });

  it('chi tiết đơn vị có đường dẫn từ gốc và trưởng (AC-2.9.4)', async () => {
    const flat = (await http.get('/api/v1/departments').set(EMPLOYEE)).body;
    const be = flat.find((d: any) => d.code === 'ENG-WEB-BE');
    const detail = (await http.get(`/api/v1/departments/${be.id}`).set(EMPLOYEE).expect(200)).body;
    expect(detail).toMatchObject({ unitType: 'TEAM', status: 'ACTIVE' });
    expect(detail.path.map((p: any) => p.unitType)).toEqual(['COMPANY', 'CENTER', 'DEPARTMENT', 'TEAM']);
    expect(detail.head?.fullName).toBeTruthy();
  });

  it('luật loại cha, loại con (AC-2.4.8, AC-2.4.9)', async () => {
    const flat = (await http.get('/api/v1/departments').set(HR)).body;
    const id = (c: string) => flat.find((d: any) => d.code === c).id;
    const code = () => `T-${Math.floor(Math.random() * 1e6)}`;
    const unit = (name: string, unitType: string, parentId: string) => ({ code: code(), name, office: 'Hà Nội', unitType, parentId });
    // AC-2.4.9: phòng thẳng dưới công ty.
    const leg = (await http.post('/api/v1/departments').set(HR).send(unit('Kiểm soát nội bộ test', 'DEPARTMENT', id('HQ'))).expect(201)).body;
    expect(leg.unitType).toBe('DEPARTMENT');
    // AC-2.4.8: nhóm dưới trung tâm, trung tâm dưới trung tâm, phòng dưới phòng.
    for (const [type, parent] of [['TEAM', 'ENG'], ['CENTER', 'ENG'], ['DEPARTMENT', 'ENG-WEB'], ['COMPANY', 'HQ']]) {
      const res = await http.post('/api/v1/departments').set(HR).send(unit('Sai luật', type, id(parent))).expect(400);
      expect(res.body.message).toBeTruthy();
    }
    // Đổi loại làm đơn vị con sai luật: Trung tâm Công nghệ thành Phòng thì các phòng con nằm dưới phòng.
    await http.patch(`/api/v1/departments/${id('ENG')}`).set(HR).send({ unitType: 'DEPARTMENT' }).expect(400);
    // Chuyển nhóm sang dưới phòng khác: hợp lệ; sang dưới trung tâm: sai luật.
    const team = (await http.post('/api/v1/departments').set(HR).send(unit('Nhóm test', 'TEAM', leg.id)).expect(201)).body;
    await http.patch(`/api/v1/departments/${team.id}`).set(HR).send({ parentId: id('ENG') }).expect(400);
    await http.patch(`/api/v1/departments/${team.id}`).set(HR).send({ parentId: id('ENG-PLT') }).expect(200);
  });

  it('lọc danh bạ theo đơn vị mặc định gồm đơn vị con (AC-2.1.5)', async () => {
    const flat = (await http.get('/api/v1/departments').set(EMPLOYEE)).body;
    const eng = flat.find((d: any) => d.code === 'ENG').id;
    const all = (await http.get(`/api/v1/employees?dept=${eng}&size=1`).set(EMPLOYEE).expect(200)).body.total;
    const own = (await http.get(`/api/v1/employees?dept=${eng}&includeChildren=false&size=1`).set(EMPLOYEE).expect(200)).body.total;
    expect(own).toBeGreaterThanOrEqual(1); // giám đốc trung tâm
    expect(all).toBeGreaterThan(own);
    const members = (await http.get(`/api/v1/departments/${eng}/members?size=1`).set(EMPLOYEE).expect(200)).body.total;
    expect(members).toBe(own);
    const withChildren = (await http.get(`/api/v1/departments/${eng}/members?size=1&includeChildren=true`).set(EMPLOYEE)).body.total;
    expect(withChildren).toBe(all);
  });

  it('thành viên phòng ban và nhân viên trực thuộc', async () => {
    const me = (await http.get(`/api/v1/employees/${employeeId}/summary`).set(EMPLOYEE)).body;
    const members = await http.get(`/api/v1/departments/${me.departmentId}/members?size=5`).set(EMPLOYEE).expect(200);
    expect(members.body.total).toBeGreaterThan(5);
    const reports = await http.get(`/api/v1/employees/${managerId}/direct-reports`).set(EMPLOYEE).expect(200);
    expect(reports.body.map((r: any) => r.id)).toContain(employeeId);
  });

  it('nhân viên không tạo được phòng ban; HR tạo được', async () => {
    const hq = (await http.get('/api/v1/departments').set(EMPLOYEE)).body.find((d: any) => d.code === 'HQ');
    const dto = { code: `T-${Date.now() % 100000}`, name: 'Phòng test', office: 'Hà Nội', unitType: 'DEPARTMENT', parentId: hq.id };
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
      const hq = (await http.get('/api/v1/departments').set(HR)).body.find((d: any) => d.code === 'HQ');
      const dept = (name: string, parentId: string, unitType = 'DEPARTMENT') => ({ code: code(), name, office: 'Hà Nội', unitType, parentId });
      const a = (await http.post('/api/v1/departments').set(ADMIN).send(dept('Phòng test A', hq.id)).expect(201)).body;
      await http.post('/api/v1/departments').set(MANAGER).send(dept('Phòng test', hq.id)).expect(403);
      const b = (await http.post('/api/v1/departments').set(HR).send(dept('Nhóm test B', a.id, 'TEAM')).expect(201)).body;

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
      const dept = (await http.get('/api/v1/departments').set(HR)).body.find((d: any) => d.code !== 'HQ');
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
      await ds.query('DELETE FROM employee.employment_assignment WHERE employee_id = $1', [res.body.id]);
      await ds.query('DELETE FROM employee.employee WHERE id = $1', [res.body.id]);
    });

    it('lỗi validation trả thêm fields theo từng trường', async () => {
      const res = await http.patch(`/api/v1/employees/${employeeId}`).set(EMPLOYEE).send({ phone: 'abc', version: 1 }).expect(400);
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
      await http.patch(`/api/v1/employees/${employeeId}`).set(MANAGER).send({ phone: '0912000444', version: 1 }).expect(403);
      await http.patch(`/api/v1/employees/${employeeId}`).set(MANAGER).send({ nationalId: '001234567890', version: 1 }).expect(403);
      await http.patch(`/api/v1/employees/${employeeId}`).set(ADMIN).send({ phone: '0912000555', version: 1 }).expect(403);
      await http.patch(`/api/v1/employees/${employeeId}`).set(ADMIN).send({ salary: '1000', version: 1 }).expect(403);
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
      const dept = (await http.get('/api/v1/departments').set(HR)).body.find((d: any) => d.code !== 'HQ');
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
      expect((await transfer(employeeId, { managerId: terminatedId })).body.message).toMatch(/nghỉ việc/);
      expect((await transfer(ceo.id, { managerId })).body.message).toMatch(/CEO không có quản lý/);
      expect((await transfer(employeeId, { managerId: null })).body.message).toMatch(/quản lý trực tiếp/);
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

      const other = depts.find((x: any) => x.id !== me.departmentId && x.parentId !== me.departmentId && x.code !== 'HQ');
      expect((await transfer(me.id, { departmentId: other.id })).status).toBe(201);
      try {
        await http.get(`/api/v1/documents/${d.id}`).set(EMPLOYEE).expect(404);
      } finally {
        expect((await transfer(me.id, { departmentId: me.departmentId })).status).toBe(201);
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

  describe('UC1 toàn vẹn hồ sơ (AC-1.4.3, 1.4.4, 1.6.2, 1.6.3, 1.7.1, 1.7.2; UC2 AC-2.4.6, 2.4.7)', () => {
    const auditOf = async (id: string) =>
      (await http.get(`/api/v1/audit-logs?entity=employee&entityId=${id}`).set(HR).expect(200)).body.items;

    it('sửa hồ sơ không kèm version → 400 (AC-1.6.2)', async () => {
      await http.patch(`/api/v1/employees/${employeeId}`).set(HR).send({ address: 'Không version' }).expect(400);
    });

    it('chỉ đổi lương cũng tăng version: người mở form cũ nhận 409 (AC-1.6.3)', async () => {
      const v = await versionOf(employeeId);
      await http.patch(`/api/v1/employees/${employeeId}`).set(HR).send({ salary: '26000000', version: v }).expect(200);
      expect(await versionOf(employeeId)).toBe(v + 1);
      await http.patch(`/api/v1/employees/${employeeId}`).set(HR).send({ address: 'HR2 ghi đè', version: v }).expect(409);
    });

    it('audit theo nhóm trường: ngày vào làm có giá trị cũ, mới; địa chỉ chỉ có tên (AC-1.4.3, AC-1.4.4)', async () => {
      const before = (await http.get(`/api/v1/employees/${employeeId}`).set(HR)).body;
      const newDate = before.hireDate === '2016-03-08' ? '2016-03-09' : '2016-03-08';
      await http
        .patch(`/api/v1/employees/${employeeId}`)
        .set(HR)
        .send({ hireDate: newDate, address: `${Date.now() % 1000} Đường Kiểm Thử`, version: before.version })
        .expect(200);
      const log = (await auditOf(employeeId)).find((l: any) => l.action === 'UPDATE' && l.changedFields?.hireDate);
      expect(log.changedFields.hireDate).toEqual({ from: before.hireDate, to: newDate });
      expect(log.changedFields.address).toBe('***');
      expect(JSON.stringify(log.changedFields)).not.toContain('Kiểm Thử');
      const v6 = await versionOf(employeeId);
      await http
        .patch(`/api/v1/employees/${employeeId}`)
        .set(HR)
        .send({ hireDate: before.hireDate, address: before.address, version: v6 })
        .expect(200);
    });

    it('HR sửa email công ty: trùng thì 409; mã nhân viên không sửa được (AC-1.4.4)', async () => {
      const other = (await http.get(`/api/v1/employees/${strangerId}`).set(HR)).body;
      const v7 = await versionOf(employeeId);
      await http
        .patch(`/api/v1/employees/${employeeId}`)
        .set(HR)
        .send({ workEmail: other.workEmail.toUpperCase(), version: v7 })
        .expect(409);
      const v8 = await versionOf(employeeId);
      await http
        .patch(`/api/v1/employees/${employeeId}`)
        .set(HR)
        .send({ employeeCode: 'E99999', version: v8 })
        .expect(400);
    });

    it('không cho nghỉ việc khi còn cấp dưới (AC-1.7.1)', async () => {
      const v9 = await versionOf(managerId);
      const res = await http
        .patch(`/api/v1/employees/${managerId}`)
        .set(HR)
        .send({ status: 'TERMINATED', version: v9 })
        .expect(400);
      expect(res.body.message).toMatch(/cấp dưới/);
    });

    it('người đã nghỉ việc gọi API bằng token còn hạn → 403 (AC-1.7.2)', async () => {
      const positions = (await http.get('/api/v1/positions').set(HR)).body;
      const me = (await http.get(`/api/v1/employees/${employeeId}`).set(HR)).body;
      const email = `leaver-${Date.now() % 100000}@hr.local`;
      const created = (
        await http
          .post('/api/v1/employees')
          .set(HR)
          .send({
            employeeCode: `E9${String(Date.now()).slice(-4)}`,
            fullName: 'Người Sắp Nghỉ',
            workEmail: email,
            departmentId: me.departmentId,
            positionId: positions.find((p: any) => p.code !== 'CEO').id,
            managerId,
            hireDate: '2026-11-01',
          })
          .expect(201)
      ).body;
      const { DataSource } = await import('typeorm');
      const ds = app.get(DataSource);
      try {
        await http.get('/api/v1/me').set(as(email)).expect(200);
        const v10 = await versionOf(created.id);
        await http
          .patch(`/api/v1/employees/${created.id}`)
          .set(HR)
          .send({ status: 'TERMINATED', version: v10 })
          .expect(200);
        await http.get('/api/v1/me').set(as(email)).expect(403);
      } finally {
        await ds.query('DELETE FROM iam.user_account WHERE employee_id = $1', [created.id]);
        await ds.query('DELETE FROM employee.employment_assignment WHERE employee_id = $1', [created.id]);
        await ds.query('DELETE FROM employee.employee WHERE id = $1', [created.id]);
      }
    });

    it('cây tổ chức chỉ một gốc; trưởng đơn vị phải đang làm việc (UC2 AC-2.4.6, AC-2.4.7)', async () => {
      const depts = (await http.get('/api/v1/departments').set(HR)).body;
      const hq = depts.find((d: any) => d.code === 'HQ');
      const child = depts.find((d: any) => d.parentId === hq.id);
      const code = () => `T-${Math.floor(Math.random() * 1e5)}`;
      await http
        .post('/api/v1/departments')
        .set(HR)
        .send({ code: code(), name: 'Gốc thứ hai', office: 'Hà Nội', unitType: 'COMPANY' })
        .expect(400);
      await http.patch(`/api/v1/departments/${child.id}`).set(HR).send({ parentId: null }).expect(400);
      const { DataSource } = await import('typeorm');
      const [{ id: leaver }] = await app.get(DataSource).query(`SELECT id FROM employee.employee WHERE status = 'TERMINATED' LIMIT 1`);
      await http
        .post('/api/v1/departments')
        .set(HR)
        .send({ code: code(), name: 'Trưởng đã nghỉ', office: 'Hà Nội', unitType: 'DEPARTMENT', parentId: hq.id, headEmployeeId: leaver })
        .expect(400);
    });
  });

  describe('UC1 yêu cầu cập nhật hồ sơ và nhật ký (AC-1.2.x, AC-1.6.4, AC-1.9.x, AC-1.11.x)', () => {
    let seq = 0;
    const key = () => ({ 'Idempotency-Key': `e2e-${Date.now()}-${++seq}` });
    const submit = (body: object, who = EMPLOYEE, k = key()) =>
      http.post(`/api/v1/employees/${employeeId}/change-requests`).set(who).set(k).send(body);
    const contact = { fullName: 'Lê Văn Khẩn', relation: 'Cha', phone: '0912 111 222' };

    beforeAll(async () => {
      const { DataSource } = await import('typeorm');
      const ds = app.get(DataSource);
      // Dọn dữ liệu của lần chạy trước để đếm số dòng, số yêu cầu đúng.
      await ds.query(`UPDATE employee.profile_change_request SET status = 'CANCELLED' WHERE employee_id = $1 AND status = 'PENDING'`, [employeeId]);
      await ds.query(`UPDATE employee.profile_item SET deleted_at = now() WHERE employee_id = $1 AND deleted_at IS NULL`, [employeeId]);
    });

    it('sửa điện thoại qua yêu cầu: 202, hồ sơ và version chưa đổi; số sai mẫu 400 (AC-1.2.1, 1.2.3)', async () => {
      const before = (await http.get(`/api/v1/employees/${employeeId}/profile/personal`).set(EMPLOYEE)).body;
      const bad = await submit({ section: 'personal', action: 'UPDATE', proposed: { phone: 'abc' } }).expect(400);
      expect(bad.body.fields.phone).toBeDefined();
      const res = await submit({ section: 'personal', action: 'UPDATE', proposed: { phone: '0912 555 666' } }).expect(202);
      expect(res.body).toMatchObject({ status: 'PENDING', section: 'personal', baseVersion: before.version });
      const after = (await http.get(`/api/v1/employees/${employeeId}/profile/personal`).set(EMPLOYEE)).body;
      expect(after.version).toBe(before.version);
      expect(after.phone).toBe(before.phone);
      expect(after.requests.map((r: any) => r.id)).toContain(res.body.id);
      // Quản lý trực tiếp chỉ thấy dữ liệu hiện tại (AC-1.9.2).
      const asManager = (await http.get(`/api/v1/employees/${employeeId}/profile/personal`).set(MANAGER)).body;
      expect(asManager.requests).toEqual([]);
    });

    it('HR duyệt: hồ sơ đổi, version tăng, audit không có giá trị; duyệt lại trả lại yêu cầu (AC-1.9.4, E20)', async () => {
      const req = (await submit({ section: 'personal', action: 'UPDATE', proposed: { address: `${Date.now() % 1000} Đường Duyệt` } }).expect(202)).body;
      const v = await versionOf(employeeId);
      await http.post(`/api/v1/change-requests/${req.id}/approve`).set(EMPLOYEE).expect(403);
      const ok = await http.post(`/api/v1/change-requests/${req.id}/approve`).set(HR).expect(200);
      expect(ok.body.status).toBe('APPROVED');
      expect(await versionOf(employeeId)).toBe(v + 1);
      const p = (await http.get(`/api/v1/employees/${employeeId}/profile/personal`).set(EMPLOYEE)).body;
      expect(p.address).toMatch(/Đường Duyệt$/);
      await http.post(`/api/v1/change-requests/${req.id}/approve`).set(HR).expect(200);
      const logs = (await http.get(`/api/v1/audit-logs?entity=employee&entityId=${employeeId}`).set(HR)).body.items;
      const approve = logs.filter((l: any) => l.action === 'PROFILE_CHANGE_APPROVE' && l.changedFields.requestId === req.id);
      expect(approve).toHaveLength(1);
      expect(JSON.stringify(approve[0].changedFields)).not.toContain('Đường Duyệt');
    });

    it('thêm liên hệ khẩn cấp: chờ duyệt, từ chối cần lý do; nhân viên thấy lý do, đóng được (AC-1.9.1, 1.9.5)', async () => {
      const req = (await submit({ section: 'emergency-contacts', action: 'CREATE', proposed: contact }).expect(202)).body;
      let section = (await http.get(`/api/v1/employees/${employeeId}/profile/emergency-contacts`).set(EMPLOYEE)).body;
      expect(section.rows).toHaveLength(0);
      expect(section.requests[0]).toMatchObject({ id: req.id, action: 'CREATE', proposed: contact });
      await http.post(`/api/v1/change-requests/${req.id}/reject`).set(HR).send({}).expect(400);
      await http.post(`/api/v1/change-requests/${req.id}/reject`).set(HR).send({ reason: 'Thiếu giấy tờ' }).expect(200);
      section = (await http.get(`/api/v1/employees/${employeeId}/profile/emergency-contacts`).set(EMPLOYEE)).body;
      expect(section.requests[0]).toMatchObject({ status: 'REJECTED', rejectReason: 'Thiếu giấy tờ' });
      const logs = (await http.get(`/api/v1/audit-logs?entity=employee&entityId=${employeeId}`).set(HR)).body.items;
      expect(JSON.stringify(logs.find((l: any) => l.action === 'PROFILE_CHANGE_REJECT'))).not.toContain('Thiếu giấy tờ');
      await http.post(`/api/v1/employees/${employeeId}/change-requests/${req.id}/acknowledge`).set(EMPLOYEE).expect(204);
      section = (await http.get(`/api/v1/employees/${employeeId}/profile/emergency-contacts`).set(EMPLOYEE)).body;
      expect(section.requests).toEqual([]);
    });

    it('Idempotency-Key: gửi lại trả yêu cầu cũ; thiếu key 400; nhân viên hủy được (AC-1.9.12, AC-1.9.2)', async () => {
      const k = key();
      const a = (await submit({ section: 'emergency-contacts', action: 'CREATE', proposed: contact }, EMPLOYEE, k).expect(202)).body;
      const b = (await submit({ section: 'emergency-contacts', action: 'CREATE', proposed: contact }, EMPLOYEE, k).expect(202)).body;
      expect(b.id).toBe(a.id);
      await http
        .post(`/api/v1/employees/${employeeId}/change-requests`)
        .set(EMPLOYEE)
        .send({ section: 'emergency-contacts', action: 'CREATE', proposed: contact })
        .expect(400);
      await http.delete(`/api/v1/employees/${employeeId}/change-requests/${a.id}`).set(EMPLOYEE).expect(204);
      await http.delete(`/api/v1/employees/${employeeId}/change-requests/${a.id}`).set(EMPLOYEE).expect(409);
    });

    it('mục HR quản lý, hồ sơ người khác, sai dữ liệu, quá số dòng → 403, 403, 400, 409 (AC-1.9.8, AC-1.9.9)', async () => {
      await submit({ section: 'salary', action: 'UPDATE', proposed: { salary: '1' } }).expect(403);
      await http
        .post(`/api/v1/employees/${strangerId}/change-requests`)
        .set(EMPLOYEE)
        .set(key())
        .send({ section: 'emergency-contacts', action: 'CREATE', proposed: contact })
        .expect(403);
      await submit({ section: 'emergency-contacts', action: 'CREATE', proposed: { ...contact, relation: 'Bạn' } }).expect(400);
      for (let i = 0; i < 3; i++) await submit({ section: 'emergency-contacts', action: 'CREATE', proposed: contact }).expect(202);
      await submit({ section: 'emergency-contacts', action: 'CREATE', proposed: contact }).expect(409);
    });

    it('duyệt khi dòng đã đổi sau khi gửi → 409; mỗi dòng có version riêng (AC-1.6.4, AC-1.9.6)', async () => {
      const pending = (await http.get(`/api/v1/change-requests?section=emergency-contacts&size=100`).set(HR).expect(200)).body.items.filter(
        (r: any) => r.employeeId === employeeId,
      );
      await http.post(`/api/v1/change-requests/${pending[0].id}/approve`).set(HR).expect(200);
      const row = (await http.get(`/api/v1/employees/${employeeId}/profile/emergency-contacts`).set(EMPLOYEE)).body.rows[0];
      expect(row).toMatchObject({ version: 1, data: contact });
      const upd = (
        await submit({
          section: 'emergency-contacts',
          action: 'UPDATE',
          itemId: row.id,
          baseVersion: row.version,
          proposed: { ...contact, phone: '0912 999 888' },
        }).expect(202)
      ).body;
      // HR sửa thẳng dòng đó trước (A9).
      await http
        .patch(`/api/v1/employees/${employeeId}/profile/emergency-contacts/${row.id}`)
        .set(HR)
        .send({ version: row.version, data: { ...contact, fullName: 'Lê Văn Sửa' } })
        .expect(204);
      await http.post(`/api/v1/change-requests/${upd.id}/approve`).set(HR).expect(409);
    });

    it('người phụ thuộc: mã số thuế mã hóa, chỉ hiện khi bấm mắt; HR xem đề xuất nhạy cảm (AC-1.9.3, 1.9.11)', async () => {
      const req = (
        await submit({
          section: 'relatives',
          action: 'CREATE',
          proposed: { fullName: 'Trần Bé', relation: 'Con', dateOfBirth: '2018-02-03', isDependent: true, taxId: '012345678901', dependentFrom: '2026-01' },
        }).expect(202)
      ).body;
      expect(req.proposed).not.toHaveProperty('taxId');
      expect(req.proposedSensitive.taxId).toEqual({ hasValue: true, value: null });
      const masked = (await http.get(`/api/v1/change-requests/${req.id}`).set(HR).expect(200)).body;
      expect(masked.proposedSensitive.taxId.value).toBeNull();
      const shown = (await http.get(`/api/v1/change-requests/${req.id}?reveal=true`).set(HR).expect(200)).body;
      expect(shown.proposedSensitive.taxId.value).toBe('012345678901');
      await http.post(`/api/v1/change-requests/${req.id}/approve`).set(HR).expect(200);
      const { DataSource } = await import('typeorm');
      const [raw] = await app.get(DataSource).query(`SELECT sensitive_data FROM employee.profile_item WHERE change_request_id = $1`, [req.id]);
      expect(raw.sensitive_data).not.toContain('012345678901');
      const rows = (await http.get(`/api/v1/employees/${employeeId}/profile/relatives?reveal=true`).set(EMPLOYEE).expect(200)).body.rows;
      expect(rows[0].sensitive.taxId.value).toBe('012345678901');
    });

    it('HR xem danh sách chờ, cũ nhất trước; quản lý không xem được (AC-1.9.3)', async () => {
      await http.get('/api/v1/change-requests').set(MANAGER).expect(403);
      const list = (await http.get('/api/v1/change-requests?size=100').set(HR).expect(200)).body.items;
      const times = list.map((r: any) => r.submittedAt);
      expect([...times].sort()).toEqual(times);
      expect(list[0]).toHaveProperty('overdue');
    });

    it('lịch sử thay đổi: chủ hồ sơ và HR xem, không có giá trị; quản lý 403 (AC-1.11.1, 1.11.2)', async () => {
      const h = (await http.get(`/api/v1/employees/${employeeId}/history?size=50`).set(EMPLOYEE).expect(200)).body;
      const actions = h.items.map((x: any) => x.action);
      expect(actions).toEqual(expect.arrayContaining(['PROFILE_CHANGE_SUBMIT', 'PROFILE_CHANGE_APPROVE', 'PROFILE_CHANGE_REJECT']));
      expect(JSON.stringify(h)).not.toContain('Lê Văn Khẩn');
      await http.get(`/api/v1/employees/${employeeId}/history?section=relatives`).set(HR).expect(200);
      await http.get(`/api/v1/employees/${employeeId}/history`).set(MANAGER).expect(403);
    });
  });

  describe('UC1 file hồ sơ (AC-1.10.x, AC-1.14.2, AC-1.14.3)', () => {
    let seq = 0;
    const key = () => ({ 'Idempotency-Key': `e2e-file-${Date.now()}-${++seq}` });
    const pdf = (tag: string) => Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from(`e2e ${tag} ${Date.now()} ${Math.random()}`)]);
    const PDF = 'application/pdf';

    /** Xin URL, "PUT" vào bucket giả, xác nhận. */
    const upload = async (who: Record<string, string>, section: string, name: string, type: string, body: Buffer, opts: { declaredSize?: number; itemId?: string | null } = {}) => {
      const r = await http
        .post(`/api/v1/employees/${employeeId}/files`)
        .set(who)
        .send({ section, itemId: opts.itemId, fileName: name, contentType: type, size: opts.declaredSize ?? body.length, sha256: sha256(body) });
      if (r.status !== 201 || r.body.existing) return { req: r, confirm: null as any };
      bucket.upload(r.body.upload.url, body);
      const confirm = await http.post(`/api/v1/employees/${employeeId}/files/${r.body.file.id}/confirm`).set(who);
      return { req: r, confirm };
    };

    beforeAll(async () => {
      const { DataSource } = await import('typeorm');
      const ds = app.get(DataSource);
      await ds.query(`UPDATE employee.employee SET avatar_file_id = NULL WHERE id = $1`, [employeeId]);
      await ds.query(`UPDATE employee.profile_change_request SET status = 'CANCELLED' WHERE employee_id = $1 AND status = 'PENDING'`, [employeeId]);
      await ds.query(`UPDATE employee.profile_file SET status = 'DELETED' WHERE employee_id = $1 AND status <> 'DELETED'`, [employeeId]);
    });

    it('chưa cấu hình bucket hồ sơ: thao tác file 503, xem hồ sơ vẫn chạy (AC-1.10.9)', async () => {
      bucket.enabled = false;
      try {
        await http
          .post(`/api/v1/employees/${employeeId}/files`)
          .set(EMPLOYEE)
          .send({ section: 'cv', fileName: 'cv.pdf', contentType: PDF, size: 10, sha256: sha256(Buffer.from('x')) })
          .expect(503);
        await http.get(`/api/v1/employees/${employeeId}/summary`).set(EMPLOYEE).expect(200);
      } finally {
        bucket.enabled = true;
      }
    });

    it('tải CV: PENDING_REVIEW, audit không có tên file; HR duyệt yêu cầu thì READY (AC-1.10.1, AC-1.9.4)', async () => {
      const { req, confirm } = await upload(EMPLOYEE, 'cv', 'CV Trần Thị Nhân.pdf', PDF, pdf('cv'));
      expect(req.status).toBe(201);
      expect(req.body.upload.expiresInSeconds).toBe(600);
      expect(confirm.status).toBe(200);
      expect(confirm.body.status).toBe('PENDING_REVIEW');
      const logs = (await http.get(`/api/v1/audit-logs?entity=employee&entityId=${employeeId}`).set(HR)).body.items;
      const up = logs.find((l: any) => l.action === 'PROFILE_FILE_UPLOAD' && l.changedFields.fileId === confirm.body.id);
      expect(up.changedFields).toMatchObject({ section: 'cv', contentType: PDF, sha256: expect.any(String) });
      expect(JSON.stringify(up)).not.toContain('Trần Thị Nhân');

      const cr = (await http.post(`/api/v1/employees/${employeeId}/change-requests`).set(EMPLOYEE).set(key()).send({ section: 'cv', action: 'CREATE', fileIds: [confirm.body.id] }).expect(202)).body;
      expect(cr.files[0]).toMatchObject({ id: confirm.body.id, status: 'PENDING_REVIEW' });
      await http.post(`/api/v1/change-requests/${cr.id}/approve`).set(HR).expect(200);
      const files = (await http.get(`/api/v1/employees/${employeeId}/files?section=cv`).set(EMPLOYEE).expect(200)).body;
      expect(files.find((f: any) => f.id === confirm.body.id).status).toBe('READY');
    });

    it('tải lại cùng nội dung trả file cũ (AC-1.10.4)', async () => {
      const body = pdf('dup');
      const first = await upload(EMPLOYEE, 'cv', 'a.pdf', PDF, body);
      const cr = (await http.post(`/api/v1/employees/${employeeId}/change-requests`).set(EMPLOYEE).set(key()).send({ section: 'cv', action: 'CREATE', fileIds: [first.confirm.body.id] }).expect(202)).body;
      await http.post(`/api/v1/change-requests/${cr.id}/approve`).set(HR).expect(200);
      const again = await upload(EMPLOYEE, 'cv', 'b.pdf', PDF, body);
      expect(again.req.body).toMatchObject({ existing: true, file: { id: first.confirm.body.id } });
    });

    it('nội dung không khớp loại hoặc sai dung lượng: 400, file REJECTED, object bị xóa (AC-1.10.2, E12, E13)', async () => {
      const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('zip giả ' + Date.now())]);
      const fake = await upload(EMPLOYEE, 'cv', 'giả.pdf', PDF, zip);
      expect(fake.confirm.status).toBe(400);
      await http.post(`/api/v1/employees/${employeeId}/files/${fake.req.body.file.id}/confirm`).set(EMPLOYEE).expect(200);
      const files = (await http.get(`/api/v1/employees/${employeeId}/files?section=cv`).set(HR)).body;
      expect(files.map((f: any) => f.id)).not.toContain(fake.req.body.file.id);
      // Chưa PUT lên storage thì 400 và file vẫn chờ.
      const body = pdf('missing');
      const r = await http.post(`/api/v1/employees/${employeeId}/files`).set(EMPLOYEE).send({ section: 'cv', fileName: 'x.pdf', contentType: PDF, size: body.length, sha256: sha256(body) }).expect(201);
      await http.post(`/api/v1/employees/${employeeId}/files/${r.body.file.id}/confirm`).set(EMPLOYEE).expect(400);
      // Khai báo sai: .exe, quá 10 MiB.
      await http.post(`/api/v1/employees/${employeeId}/files`).set(EMPLOYEE).send({ section: 'cv', fileName: 'x.exe', contentType: 'application/octet-stream', size: 5, sha256: sha256(body) }).expect(400);
      await http.post(`/api/v1/employees/${employeeId}/files`).set(EMPLOYEE).send({ section: 'cv', fileName: 'x.pdf', contentType: PDF, size: 11 * 1024 * 1024, sha256: sha256(body) }).expect(400);
    });

    it('tải xuống: attachment, nosniff, không có link storage; người khác 404; HR tải có audit (AC-1.10.5, 1.10.6)', async () => {
      const ready = (await http.get(`/api/v1/employees/${employeeId}/files?section=cv`).set(EMPLOYEE)).body.find((f: any) => f.status === 'READY');
      const res = await http.get(`/api/v1/employees/${employeeId}/files/${ready.id}/download`).set(EMPLOYEE).buffer(true).expect(200);
      expect(res.headers['content-disposition']).toMatch(/^attachment;/);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(JSON.stringify(res.headers)).not.toContain('memory://');
      await http.get(`/api/v1/employees/${employeeId}/files/${ready.id}/download`).set(MANAGER).expect(404);
      await http.get(`/api/v1/employees/${employeeId}/files?section=cv`).set(MANAGER).expect(404);
      await http.get(`/api/v1/employees/${employeeId}/files/${ready.id}/download`).set(HR).expect(200);
      const logs = (await http.get(`/api/v1/audit-logs?entity=employee&entityId=${employeeId}`).set(HR)).body.items;
      expect(logs[0]).toMatchObject({ action: 'PROFILE_FILE_DOWNLOAD' });
    });

    it('file HR tải lên: READY ngay, nhân viên không đề xuất xóa được; HR xóa thì nhân viên không tải được (A8, E14, AC-1.10.7)', async () => {
      const hrFile = await upload(HR, 'cv', 'quyết định.pdf', PDF, pdf('hr'));
      expect(hrFile.confirm.body.status).toBe('READY');
      await http.post(`/api/v1/employees/${employeeId}/change-requests`).set(EMPLOYEE).set(key()).send({ section: 'cv', action: 'DELETE', fileIds: [hrFile.confirm.body.id] }).expect(403);
      await http.delete(`/api/v1/employees/${employeeId}/files/${hrFile.confirm.body.id}`).set(EMPLOYEE).expect(403);
      await http.delete(`/api/v1/employees/${employeeId}/files/${hrFile.confirm.body.id}`).set(HR).expect(204);
      await http.get(`/api/v1/employees/${employeeId}/files/${hrFile.confirm.body.id}/download`).set(EMPLOYEE).expect(404);
      await http.get(`/api/v1/employees/${employeeId}/files/${hrFile.confirm.body.id}/download`).set(HR).expect(200);
      expect([...bucket.tags.values()]).toContainEqual({ deleted: 'true' });
    });

    it('ảnh đại diện: cắt 512 × 512, bỏ EXIF; duyệt xong mọi người thấy (AC-1.10.3)', async () => {
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#0e7490' } })
        .png()
        .withMetadata({ exif: { IFD0: { Copyright: 'GPS test' } } })
        .toBuffer();
      const { confirm } = await upload(EMPLOYEE, 'avatar', 'me.png', 'image/png', png);
      expect(confirm.body).toMatchObject({ status: 'PENDING_REVIEW', contentType: 'image/jpeg' });
      const cr = (await http.post(`/api/v1/employees/${employeeId}/change-requests`).set(EMPLOYEE).set(key()).send({ section: 'avatar', action: 'CREATE', fileIds: [confirm.body.id] }).expect(202)).body;
      expect((await http.get(`/api/v1/employees/${employeeId}/summary`).set(ADMIN)).body.hasAvatar).toBe(false);
      await http.post(`/api/v1/change-requests/${cr.id}/approve`).set(HR).expect(200);
      expect((await http.get(`/api/v1/employees/${employeeId}/summary`).set(ADMIN)).body.hasAvatar).toBe(true);
      const img = await http.get(`/api/v1/employees/${employeeId}/avatar`).set(ADMIN).buffer(true).parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      }).expect(200);
      const m = await sharp(img.body as Buffer).metadata();
      expect([m.width, m.height, m.format]).toEqual([512, 512, 'jpeg']);
      expect(m.exif).toBeUndefined();
      // Ảnh đại diện quá 2 MiB bị từ chối từ khai báo.
      await http.post(`/api/v1/employees/${employeeId}/files`).set(EMPLOYEE).send({ section: 'avatar', fileName: 'a.png', contentType: 'image/png', size: 3 * 1024 * 1024, sha256: sha256(png) }).expect(400);
    });

    it('người khác không tải file lên hồ sơ người khác (404 như không tồn tại)', async () => {
      const body = pdf('other');
      await http
        .post(`/api/v1/employees/${employeeId}/files`)
        .set(MANAGER)
        .send({ section: 'cv', fileName: 'x.pdf', contentType: PDF, size: body.length, sha256: sha256(body) })
        .expect(404);
    });
  });

  describe('UC1 mục HR quản lý và thuế TNCN (FR-1.12, AC-1.9.11)', () => {
    const today = new Date().toISOString().slice(0, 10);
    const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
    const post = (section: string, data: object) => http.post(`/api/v1/employees/${employeeId}/profile/${section}`).set(HR).send({ data });

    beforeAll(async () => {
      const { DataSource } = await import('typeorm');
      await app.get(DataSource).query(
        `UPDATE employee.profile_item SET deleted_at = now() WHERE employee_id = $1 AND section IN ('contracts', 'salary', 'tax', 'health-insurance') AND deleted_at IS NULL`,
        [employeeId],
      );
      await app.get(DataSource).query(
        `UPDATE employee.profile_change_request SET status = 'CANCELLED' WHERE employee_id = $1 AND section = 'health-insurance' AND status IN ('PENDING', 'APPROVED')`,
        [employeeId],
      );
    });

    it('hợp đồng: HR thêm, trùng khoảng ngày 409; đầu trang hiện loại đang hiệu lực; sắp hết hạn có trong danh sách (AC-1.12.1, 1.12.2, 1.12.5)', async () => {
      await post('contracts', { type: 'FIXED_TERM', number: 'HĐ-E2E-1', startDate: '2025-01-01', endDate: plusDays(20) }).expect(204);
      await post('contracts', { type: 'FIXED_TERM', number: 'HĐ-E2E-2', startDate: today, endDate: plusDays(400) }).expect(409);
      const s = (await http.get(`/api/v1/employees/${employeeId}/summary`).set(MANAGER).expect(200)).body;
      expect(s.contractType).toBe('Xác định thời hạn');
      const expiring = (await http.get('/api/v1/contracts/expiring?days=30').set(HR).expect(200)).body;
      expect(expiring.map((c: any) => c.employeeId)).toContain(employeeId);
      await http.get('/api/v1/contracts/expiring').set(EMPLOYEE).expect(403);
    });

    it('nhân viên xem được mục HR quản lý của mình, không gửi yêu cầu được; quản lý không thấy mục CN (AC-1.12.4, AC-1.9.8)', async () => {
      const own = (await http.get(`/api/v1/employees/${employeeId}/profile/contracts`).set(EMPLOYEE).expect(200)).body;
      expect(own).toMatchObject({ canPropose: false, canEdit: false });
      expect(own.rows[0].data.number).toBe('HĐ-E2E-1');
      await http
        .post(`/api/v1/employees/${employeeId}/change-requests`)
        .set(EMPLOYEE)
        .set({ 'Idempotency-Key': `e2e-hr-${Date.now()}` })
        .send({ section: 'contracts', action: 'CREATE', proposed: { type: 'INDEFINITE', number: 'X', startDate: today } })
        .expect(403);
      await http.post(`/api/v1/employees/${employeeId}/profile/contracts`).set(EMPLOYEE).send({ data: {} }).expect(403);
      await http.get(`/api/v1/employees/${employeeId}/profile/contracts`).set(MANAGER).expect(404);
    });

    it('lương theo ngày hiệu lực: mức cũ giữ lại, "Lương mục tiêu" là mức đang hiệu lực, mã hóa khi lưu (AC-1.12.3)', async () => {
      await post('salary', { amount: '20000000', effectiveDate: '2025-01-01' }).expect(204);
      await post('salary', { amount: '23000000', effectiveDate: '2026-01-01' }).expect(204);
      await post('salary', { amount: '99000000', effectiveDate: '2099-01-01' }).expect(204);
      const masked = (await http.get(`/api/v1/employees/${employeeId}/profile/salary`).set(EMPLOYEE).expect(200)).body;
      expect(masked.rows).toHaveLength(3);
      expect(masked.current).toEqual({ hasValue: true, value: null });
      const shown = (await http.get(`/api/v1/employees/${employeeId}/profile/salary?reveal=true`).set(EMPLOYEE).expect(200)).body;
      expect(shown.current.value).toBe('23000000');
      expect(shown.currentEffectiveDate).toBe('2026-01-01');
      const { DataSource } = await import('typeorm');
      const raw = await app.get(DataSource).query(`SELECT sensitive_data FROM employee.profile_item WHERE employee_id = $1 AND section = 'salary'`, [employeeId]);
      expect(JSON.stringify(raw)).not.toContain('23000000');
      const hr = (await http.get(`/api/v1/employees/${employeeId}?include=sensitive`).set(HR)).body;
      expect(hr.sensitive.salary).toBe('23000000');
      await http.get(`/api/v1/employees/${employeeId}/profile/salary`).set(MANAGER).expect(404);
    });

    it('thuế TNCN: mã số thuế mã hóa, số người phụ thuộc tự đếm (AC-1.9.11)', async () => {
      await http.patch(`/api/v1/employees/${employeeId}/profile/tax/main`).set(HR).send({ version: 0, data: { taxCode: '0123456789' } }).expect(204);
      const tax = (await http.get(`/api/v1/employees/${employeeId}/profile/tax?reveal=true`).set(EMPLOYEE).expect(200)).body;
      expect(tax.rows[0].sensitive.taxCode.value).toBe('0123456789');
      expect(tax.dependents).toBeGreaterThanOrEqual(1);
    });

    it('BHYT: nhân viên đổi nơi khám qua yêu cầu, không sửa số thẻ; đổi lần hai trong quý 409', async () => {
      await http.patch(`/api/v1/employees/${employeeId}/profile/health-insurance/main`).set(HR).send({ version: 0, data: { cardNumber: 'DN4010123456789' } }).expect(204);
      const send = (proposed: object) =>
        http
          .post(`/api/v1/employees/${employeeId}/change-requests`)
          .set(EMPLOYEE)
          .set({ 'Idempotency-Key': `e2e-bhyt-${Date.now()}-${Math.random()}` })
          .send({ section: 'health-insurance', action: 'UPDATE', proposed });
      await send({ cardNumber: '1' }).expect(403);
      const req = (await send({ hospital: 'Bệnh viện Bạch Mai' }).expect(202)).body;
      await http.post(`/api/v1/change-requests/${req.id}/approve`).set(HR).expect(200);
      const row = (await http.get(`/api/v1/employees/${employeeId}/profile/health-insurance`).set(EMPLOYEE)).body.rows[0];
      expect(row.data).toMatchObject({ cardNumber: 'DN4010123456789', hospital: 'Bệnh viện Bạch Mai' });
      await send({ hospital: 'Bệnh viện E' }).expect(409);
    });
  });

  describe('UC1 thông tin tự tính (FR-1.13)', () => {
    it('các mốc trong công ty: thâm niên, mốc 5 năm, phép cộng thêm; quản lý xem được, người khác 404 (AC-1.13.2)', async () => {
      const hire = (await http.get(`/api/v1/employees/${employeeId}`).set(HR)).body.hireDate;
      const m = (await http.get(`/api/v1/employees/${employeeId}/profile/milestones`).set(MANAGER).expect(200)).body;
      expect(m).toMatchObject({ kind: 'computed', hireDate: hire });
      expect(m.annualLeaveBonus).toBe(Math.floor(m.years / 5));
      expect(m.milestones).toHaveLength(Math.floor(m.years / 5));
      await http.get(`/api/v1/employees/${employeeId}/profile/milestones`).set(ADMIN).expect(404);
    });

    it('quá trình công tác: điều chuyển tự vào dòng thời gian; HR thêm giai đoạn trước hệ thống (AC-1.13.1, AC-2.8.1)', async () => {
      const me = (await http.get(`/api/v1/employees/${employeeId}`).set(HR)).body;
      const positions = (await http.get('/api/v1/positions').set(HR)).body;
      const other = positions.find((p: any) => p.id !== me.positionId && p.code !== 'CEO' && p.active);
      expect((await transfer(employeeId, { positionId: other.id })).status).toBe(201);
      expect((await transfer(employeeId, { positionId: me.positionId })).status).toBe(201);
      await http
        .post(`/api/v1/employees/${employeeId}/profile/career-history`)
        .set(HR)
        .send({ data: { from: '2010-01-01', to: '2015-12-31', department: 'Chi nhánh cũ', position: 'Nhân viên', reason: 'Trước khi có hệ thống' } })
        .expect(204);
      const c = (await http.get(`/api/v1/employees/${employeeId}/profile/career-history`).set(MANAGER).expect(200)).body;
      // Đổi rồi đổi lại trong ngày: giai đoạn rỗng không hiện; giai đoạn hiện tại vẫn là chức danh cũ.
      expect(c.periods[0]).toMatchObject({ source: 'AUTO', to: null, position: positions.find((p: any) => p.id === me.positionId).title });
      expect(c.periods.some((p: any) => p.source === 'HR' && p.department === 'Chi nhánh cũ')).toBe(true);
      const raw = (await http.get(`/api/v1/employees/${employeeId}/profile/career-history?raw=true`).set(HR).expect(200)).body;
      expect(raw.rows.length).toBeGreaterThanOrEqual(1);
      await http.get(`/api/v1/employees/${employeeId}/profile/career-history`).set(ADMIN).expect(404);
    });

    it('ngày nghỉ dài: danh sách đơn ≥ 14 ngày làm việc và khoảng tạm nghỉ (AC-1.13.3)', async () => {
      const l = (await http.get(`/api/v1/employees/${employeeId}/profile/long-leaves`).set(MANAGER).expect(200)).body;
      expect(Array.isArray(l.rows)).toBe(true);
      expect(l.rows.every((r: any) => r.source === 'STATUS' || r.days >= 14)).toBe(true);
    });
  });

  describe('UC2 trưởng, phó, ngừng hoạt động đơn vị, chức danh (FR-2.6, FR-2.9, FR-2.10)', () => {
    const units = async () => (await http.get('/api/v1/departments').set(HR)).body as any[];
    const unitOf = async (code: string) => (await units()).find((d) => d.code === code);
    const detail = async (id: string, who = HR) => (await http.get(`/api/v1/departments/${id}`).set(who)).body;
    const code = () => `T-${Math.floor(Math.random() * 1e6)}`;

    it('trưởng, phó thuộc đơn vị hoặc đơn vị cha, đang làm việc, không quá số phó (AC-2.9.1, AC-2.9.6)', async () => {
      const team = await unitOf('ENG-WEB-BE');
      const web = await unitOf('ENG-WEB');
      const eng = await unitOf('ENG');
      const sal = await unitOf('SAL');
      const before = await detail(team.id);
      const { DataSource } = await import('typeorm');
      const [{ id: leaver }] = await app.get(DataSource).query(`SELECT id FROM employee.employee WHERE status = 'TERMINATED' LIMIT 1`);
      try {
        // Kiêm nhiệm: Giám đốc trung tâm làm "Quyền Trưởng nhóm".
        await http.patch(`/api/v1/departments/${team.id}`).set(HR).send({ headEmployeeId: eng.headEmployeeId, headActing: true }).expect(200);
        const d = await detail(team.id, EMPLOYEE);
        expect(d.head).toMatchObject({ id: eng.headEmployeeId, acting: true });
        // Người nhánh khác, người đã nghỉ: 400.
        await http.patch(`/api/v1/departments/${team.id}`).set(HR).send({ headEmployeeId: sal.headEmployeeId }).expect(400);
        await http.patch(`/api/v1/departments/${team.id}`).set(HR).send({ headEmployeeId: leaver }).expect(400);
        // Nhóm không có phó.
        await http.patch(`/api/v1/departments/${team.id}`).set(HR).send({ deputyEmployeeIds: [web.headEmployeeId] }).expect(400);
      } finally {
        await http.patch(`/api/v1/departments/${team.id}`).set(HR).send({ headEmployeeId: before.headEmployeeId, headActing: false }).expect(200);
      }
      // Phòng: tối đa 3 phó; phó không trùng trưởng.
      const webDetail = await detail(web.id);
      expect(webDetail.deputies.length).toBeGreaterThanOrEqual(1); // seed có Phó phòng
      const members = (await http.get(`/api/v1/departments/${web.id}/members?size=10`).set(HR)).body.items.map((m: any) => m.id);
      const others = members.filter((id: string) => id !== web.headEmployeeId);
      await http.patch(`/api/v1/departments/${web.id}`).set(HR).send({ deputyEmployeeIds: others.slice(0, 4) }).expect(400);
      await http.patch(`/api/v1/departments/${web.id}`).set(HR).send({ deputyEmployeeIds: [web.headEmployeeId] }).expect(400);
      const ids = webDetail.deputies.map((x: any) => x.id);
      // Danh sách chọn trưởng, phó: gồm người của đơn vị cha (HR).
      const pick = (await http.get(`/api/v1/employees?dept=${team.id}&includeAncestors=true&size=100`).set(HR).expect(200)).body;
      expect(pick.total).toBeGreaterThan((await http.get(`/api/v1/departments/${team.id}/members?size=1`).set(HR)).body.total);
      // Đổi phó có audit (AC-2.9.5).
      const extra = others.find((id: string) => !ids.includes(id));
      await http.patch(`/api/v1/departments/${web.id}`).set(HR).send({ deputyEmployeeIds: [...ids, extra] }).expect(200);
      expect((await detail(web.id)).deputies.map((x: any) => x.id)).toContain(extra);
      await http.patch(`/api/v1/departments/${web.id}`).set(HR).send({ deputyEmployeeIds: ids }).expect(200);
      const logs = (await http.get(`/api/v1/audit-logs?entity=department&entityId=${web.id}`).set(HR)).body.items;
      expect(logs.some((l: any) => l.changedFields?.deputies?.added?.includes(extra))).toBe(true);
    });

    it('ngừng hoạt động: còn người hoặc đơn vị con thì 409; đã trống thì ẩn khỏi cây, gỡ trưởng kiêm nhiệm (AC-2.10.1, AC-2.10.2)', async () => {
      const web = await unitOf('ENG-WEB');
      const res = await http.patch(`/api/v1/departments/${web.id}`).set(HR).send({ status: 'INACTIVE' }).expect(409);
      expect(res.body.details).toMatchObject({ activeChildren: 3 });
      expect(res.body.details.members).toBeGreaterThan(0);
      await http.patch(`/api/v1/departments/${(await unitOf('HQ')).id}`).set(HR).send({ status: 'INACTIVE' }).expect(400);

      const leg = await unitOf('LEG');
      const unit = (
        await http
          .post('/api/v1/departments')
          .set(HR)
          .send({ code: code(), name: 'Nhóm sắp giải thể', office: 'Hà Nội', unitType: 'TEAM', parentId: leg.id, headEmployeeId: leg.headEmployeeId })
          .expect(201)
      ).body;
      await http.patch(`/api/v1/departments/${unit.id}`).set(EMPLOYEE).send({ status: 'INACTIVE' }).expect(403);
      await http.patch(`/api/v1/departments/${unit.id}`).set(HR).send({ status: 'INACTIVE' }).expect(200);
      const tree = JSON.stringify((await http.get('/api/v1/departments/tree').set(HR)).body);
      expect(tree).not.toContain(unit.id);
      await http.get(`/api/v1/departments/${unit.id}`).set(EMPLOYEE).expect(404);
      expect((await units()).map((d) => d.id)).toContain(unit.id); // HR vẫn thấy để kích hoạt lại
      expect((await http.get('/api/v1/departments').set(EMPLOYEE)).body.map((d: any) => d.id)).not.toContain(unit.id);
      const inactive = await detail(unit.id);
      expect(inactive).toMatchObject({ status: 'INACTIVE', headEmployeeId: null });
      await http.patch(`/api/v1/departments/${unit.id}`).set(HR).send({ name: 'Sửa khi đã ngừng' }).expect(400);
      await http.patch(`/api/v1/departments/${unit.id}`).set(HR).send({ status: 'ACTIVE' }).expect(200);
      await http.patch(`/api/v1/departments/${unit.id}`).set(HR).send({ status: 'INACTIVE' }).expect(200);
    });

    it('chức danh: HR tạo, ngừng dùng; CEO là chức danh hệ thống (AC-2.6.1, AC-2.6.2, AC-2.6.3)', async () => {
      const list = (await http.get('/api/v1/positions').set(EMPLOYEE).expect(200)).body;
      const ceo = list.find((p: any) => p.code === 'CEO');
      expect(ceo).toMatchObject({ system: true, active: true, holderCount: 1 });
      const dto = { code: `P${Math.floor(Math.random() * 1e6)}`, title: 'Chức danh test', level: 2 };
      await http.post('/api/v1/positions').set(ADMIN).send(dto).expect(403);
      await http.post('/api/v1/positions').set(HR).send({ ...dto, level: 11 }).expect(400);
      const created = (await http.post('/api/v1/positions').set(HR).send(dto).expect(201)).body;
      await http.post('/api/v1/positions').set(HR).send(dto).expect(409);
      await http.patch(`/api/v1/positions/${created.id}`).set(HR).send({ active: false }).expect(200);
      const active = (await http.get('/api/v1/positions?active=true').set(HR)).body.map((p: any) => p.id);
      expect(active).not.toContain(created.id);
      const dept = await unitOf('LEG');
      await http
        .post('/api/v1/employees')
        .set(HR)
        .send({ employeeCode: 'E99777', fullName: 'Chức Danh Cũ', workEmail: 'old-title@hr.local', departmentId: dept.id, positionId: created.id, managerId: dept.headEmployeeId, hireDate: '2026-11-01' })
        .expect(400);
      // CEO: chỉ đổi được tên.
      await http.patch(`/api/v1/positions/${ceo.id}`).set(HR).send({ level: 9 }).expect(400);
      await http.patch(`/api/v1/positions/${ceo.id}`).set(HR).send({ active: false }).expect(400);
      await http.patch(`/api/v1/positions/${ceo.id}`).set(HR).send({ title: 'Tổng Giám đốc điều hành' }).expect(200);
      await http.patch(`/api/v1/positions/${ceo.id}`).set(HR).send({ title: ceo.title }).expect(200);
    });

    it('nghỉ việc gỡ vai trò trưởng, phó trong cùng giao dịch, có audit (AC-2.9.8)', async () => {
      const leg = await unitOf('LEG');
      const pos = (await http.get('/api/v1/positions?active=true').set(HR)).body.find((p: any) => p.code === 'DHEAD');
      const n = Math.floor(Math.random() * 9000) + 1000;
      const created = (
        await http
          .post('/api/v1/employees')
          .set(HR)
          .send({ employeeCode: `E8${n}`, fullName: 'Phó Sắp Nghỉ', workEmail: `deputy-${n}@hr.local`, departmentId: leg.id, positionId: pos.id, managerId: leg.headEmployeeId, hireDate: '2026-11-01' })
          .expect(201)
      ).body;
      const unit = (
        await http
          .post('/api/v1/departments')
          .set(HR)
          .send({ code: code(), name: 'Nhóm có trưởng sắp nghỉ', office: 'Hà Nội', unitType: 'TEAM', parentId: leg.id, headEmployeeId: created.id })
          .expect(201)
      ).body;
      const before = (await detail(leg.id)).deputies.map((x: any) => x.id);
      await http.patch(`/api/v1/departments/${leg.id}`).set(HR).send({ deputyEmployeeIds: [...before, created.id] }).expect(200);
      const profile = (await http.get(`/api/v1/employees/${created.id}`).set(HR)).body;
      await http.patch(`/api/v1/employees/${created.id}`).set(HR).send({ status: 'TERMINATED', version: profile.version }).expect(200);
      expect((await detail(leg.id)).deputies.map((x: any) => x.id)).not.toContain(created.id);
      expect((await detail(unit.id)).head).toBeNull();
      const logs = (await http.get(`/api/v1/audit-logs?entity=department&entityId=${unit.id}`).set(HR)).body.items;
      expect(logs.some((l: any) => l.changedFields?.reason === 'EMPLOYEE_TERMINATED')).toBe(true);
    });
  });

  describe('UC2 điều chuyển và quá trình công tác (FR-2.7, FR-2.8; UC1 AC-1.7.3)', () => {
    let today: string;
    let plus: (n: number) => string;
    let leg: any;
    let mkt: any;
    let staffPos: any;
    let seq = 0;
    const base = Math.floor(Math.random() * 9000);
    const mk = async (name: string, departmentId: string, managerId: string) => {
      const n = String((base + ++seq) % 10000).padStart(4, '0');
      return (
        await http
          .post('/api/v1/employees')
          .set(HR)
          .send({ employeeCode: `E7${n}`, fullName: name, workEmail: `tr-${n}-${Date.now() % 1000}@hr.local`, departmentId, positionId: staffPos.id, managerId, hireDate: '2026-10-01' })
          .expect(201)
      ).body;
    };
    const body = (e: any, change: object) => ({ effectiveDate: today, departmentId: e.departmentId, positionId: e.positionId, managerId: e.managerId, reason: 'TRANSFER', ...change });
    const post = (id: string, b: object) => http.post(`/api/v1/employees/${id}/transfers`).set(HR).send(b);
    const job = async (day: string) => {
      const { TransferService } = await import('../src/modules/employee/transfer.service');
      return app.get(TransferService).applyDue(day);
    };

    beforeAll(async () => {
      const { vnToday, addDays } = await import('../src/modules/employee/transfer-rules');
      today = vnToday();
      plus = (n) => addDays(today, n);
      const units = (await http.get('/api/v1/departments').set(HR)).body;
      leg = units.find((d: any) => d.code === 'LEG');
      mkt = units.find((d: any) => d.code === 'MKT');
      staffPos = (await http.get('/api/v1/positions?active=true').set(HR)).body.find((p: any) => p.code === 'STAFF');
    });

    it('tạo nhân viên có dòng "Tuyển mới"; sửa phòng ban qua PATCH bị chặn (AC-2.8.3, AC-2.7.7)', async () => {
      const a = await mk('Tuyển Mới Thử', leg.id, leg.headEmployeeId);
      const c = (await http.get(`/api/v1/employees/${a.id}/profile/career-history`).set(HR).expect(200)).body;
      expect(c.periods[0]).toMatchObject({ from: '2026-10-01', to: null, reason: 'Tuyển mới', department: leg.name, source: 'AUTO' });
      const res = await http.patch(`/api/v1/employees/${a.id}`).set(HR).send({ departmentId: mkt.id, version: a.version }).expect(400);
      expect(res.body.fields).toHaveProperty('departmentId');
      await http.post(`/api/v1/employees/${a.id}/transfers`).set(MANAGER).send(body(a, { departmentId: mkt.id })).expect(403);
    });

    it('hiệu lực hôm nay đổi ngay; quá 30 ngày hoặc trước ngày vào làm thì 400 (AC-2.7.1, AC-2.7.4)', async () => {
      const a = await mk('Điều Chuyển Ngay', leg.id, leg.headEmployeeId);
      await post(a.id, body(a, { departmentId: mkt.id, effectiveDate: plus(-31) })).expect(400);
      await post(a.id, body(a, { departmentId: mkt.id, effectiveDate: '2026-09-01' })).expect(400);
      const t = (await post(a.id, body(a, { departmentId: mkt.id, managerId: mkt.headEmployeeId })).expect(201)).body;
      expect(t).toMatchObject({ status: 'ACTIVE', departmentName: mkt.name });
      expect((await http.get(`/api/v1/employees/${a.id}`).set(HR)).body).toMatchObject({ departmentId: mkt.id, managerId: mkt.headEmployeeId });
      const c = (await http.get(`/api/v1/employees/${a.id}/profile/career-history`).set(HR)).body.periods;
      expect(c[0]).toMatchObject({ from: today, to: null, reason: 'Điều chuyển', department: mkt.name });
      expect(c[1]).toMatchObject({ reason: 'Tuyển mới', to: plus(-1) });
      const logs = (await http.get(`/api/v1/audit-logs?entity=employee&entityId=${a.id}`).set(HR)).body.items;
      expect(logs.some((l: any) => l.action === 'TRANSFER')).toBe(true);
    });

    it('hiệu lực tương lai: "Sắp hiệu lực", hủy được, một người chỉ một điều chuyển chờ; job áp dụng khi tới ngày (AC-2.7.2)', async () => {
      const a = await mk('Chuyển Sau', leg.id, leg.headEmployeeId);
      const t = (await post(a.id, body(a, { departmentId: mkt.id, managerId: mkt.headEmployeeId, effectiveDate: plus(10) })).expect(201)).body;
      expect(t.status).toBe('SCHEDULED');
      expect((await http.get(`/api/v1/employees/${a.id}`).set(HR)).body.departmentId).toBe(leg.id);
      const c = (await http.get(`/api/v1/employees/${a.id}/profile/career-history`).set(HR)).body.periods;
      expect(c[0]).toMatchObject({ upcoming: true, from: plus(10) });
      await post(a.id, body(a, { departmentId: mkt.id, effectiveDate: plus(12) })).expect(409);
      await http.delete(`/api/v1/employees/${a.id}/transfers/${t.id}`).set(HR).expect(204);
      await http.delete(`/api/v1/employees/${a.id}/transfers/${t.id}`).set(HR).expect(409);

      const t2 = (await post(a.id, body(a, { departmentId: mkt.id, managerId: mkt.headEmployeeId, effectiveDate: plus(5) })).expect(201)).body;
      expect((await job(plus(4))).applied).toBe(0);
      const r = await job(plus(5));
      expect(r.applied).toBeGreaterThanOrEqual(1);
      expect((await http.get(`/api/v1/employees/${a.id}`).set(HR)).body.departmentId).toBe(mkt.id);
      const list = (await http.get(`/api/v1/employees/${a.id}/transfers`).set(HR).expect(200)).body;
      expect(list.find((x: any) => x.id === t2.id).status).toBe('ACTIVE');
      expect(list.find((x: any) => x.id === t.id).status).toBe('CANCELLED');
    });

    it('job kiểm lại quy tắc: đơn vị đích đã ngừng hoạt động thì FAILED (AC-2.7.8)', async () => {
      const team = (
        await http.post('/api/v1/departments').set(HR).send({ code: `T-${Math.floor(Math.random() * 1e6)}`, name: 'Nhóm sắp đóng', office: 'Hà Nội', unitType: 'TEAM', parentId: leg.id }).expect(201)
      ).body;
      const a = await mk('Chuyển Lỗi', leg.id, leg.headEmployeeId);
      const t = (await post(a.id, body(a, { departmentId: team.id, effectiveDate: plus(3) })).expect(201)).body;
      await http.patch(`/api/v1/departments/${team.id}`).set(HR).send({ status: 'INACTIVE' }).expect(200);
      expect((await job(plus(3))).failed).toBeGreaterThanOrEqual(1);
      const list = (await http.get(`/api/v1/employees/${a.id}/transfers`).set(HR)).body;
      expect(list.find((x: any) => x.id === t.id)).toMatchObject({ status: 'FAILED' });
      expect(list.find((x: any) => x.id === t.id).failureReason).toMatch(/ngừng hoạt động/);
      expect((await http.get(`/api/v1/employees/${a.id}`).set(HR)).body.departmentId).toBe(leg.id);
    });

    it('cấp dưới: phải chọn cho từng người; đổi quản lý cùng ngày hiệu lực (AC-2.7.6); trưởng đơn vị cũ phải chọn người thay (AC-2.7.5)', async () => {
      const a = await mk('Quản Lý Đi', leg.id, leg.headEmployeeId);
      const b = await mk('Cấp Dưới Ở Lại', leg.id, a.id);
      const team = (
        await http
          .post('/api/v1/departments')
          .set(HR)
          .send({ code: `T-${Math.floor(Math.random() * 1e6)}`, name: 'Nhóm của A', office: 'Hà Nội', unitType: 'TEAM', parentId: leg.id, headEmployeeId: a.id })
          .expect(201)
      ).body;
      const base = body(a, { departmentId: mkt.id, managerId: mkt.headEmployeeId });
      const r1 = await post(a.id, base).expect(400);
      expect(r1.body.fields).toHaveProperty('reports');
      expect(r1.body.fields).toHaveProperty('newHeads');
      const ok = { ...base, reports: [{ employeeId: b.id, managerId: leg.headEmployeeId }], newHeads: [{ departmentId: team.id, employeeId: null }] };
      const t = (await post(a.id, ok).expect(201)).body;
      expect(t.reports).toEqual([expect.objectContaining({ employeeId: b.id, managerId: leg.headEmployeeId, status: 'ACTIVE' })]);
      expect((await http.get(`/api/v1/employees/${b.id}`).set(HR)).body.managerId).toBe(leg.headEmployeeId);
      expect((await http.get(`/api/v1/departments/${team.id}`).set(HR)).body.headEmployeeId).toBeNull();
      const c = (await http.get(`/api/v1/employees/${b.id}/profile/career-history`).set(HR)).body.periods;
      expect(c[0]).toMatchObject({ reason: 'Đổi quản lý', from: today });
    });

    it('nghỉ việc: là quản lý mới trong điều chuyển chờ thì 400; hộp xác nhận nêu trước; hủy điều chuyển chờ của người nghỉ (UC1 AC-1.7.3)', async () => {
      const c = await mk('Quản Lý Tương Lai', leg.id, leg.headEmployeeId);
      const d = await mk('Người Được Chuyển', leg.id, leg.headEmployeeId);
      const t = (await post(d.id, body(d, { managerId: c.id, reason: 'MANAGER_CHANGE', effectiveDate: plus(7) })).expect(201)).body;
      const impact = (await http.get(`/api/v1/employees/${c.id}/termination-impact`).set(HR).expect(200)).body;
      expect(impact).toMatchObject({ activeReports: 0, scheduledTransfers: 0 });
      expect(impact.pendingAsNewManager).toEqual([expect.objectContaining({ transferId: t.id, employeeName: d.fullName })]);
      await http.get(`/api/v1/employees/${c.id}/termination-impact`).set(MANAGER).expect(403);
      const cv = (await http.get(`/api/v1/employees/${c.id}`).set(HR)).body.version;
      const res = await http.patch(`/api/v1/employees/${c.id}`).set(HR).send({ status: 'TERMINATED', version: cv }).expect(400);
      expect(res.body.message).toMatch(/điều chuyển chưa hiệu lực/);
      // D nghỉ việc: điều chuyển chờ của D bị hủy.
      const dv = (await http.get(`/api/v1/employees/${d.id}`).set(HR)).body.version;
      expect((await http.get(`/api/v1/employees/${d.id}/termination-impact`).set(HR)).body.scheduledTransfers).toBe(1);
      await http.patch(`/api/v1/employees/${d.id}`).set(HR).send({ status: 'TERMINATED', version: dv }).expect(200);
      const list = (await http.get(`/api/v1/employees/${d.id}/transfers`).set(HR)).body;
      expect(list.find((x: any) => x.id === t.id).status).toBe('CANCELLED');
      await http.patch(`/api/v1/employees/${c.id}`).set(HR).send({ status: 'TERMINATED', version: cv }).expect(200);
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
