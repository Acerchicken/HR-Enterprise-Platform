/**
 * Cấp ADMIN đầu tiên cho một môi trường mới (ADR-18 quyết định 2). Chạy tay một lần, sau đó ADMIN cấp cho người khác trên trang
 * "Phân quyền". Có audit `ROLE_GRANT` (người làm = null, lý do ghi rõ là lệnh dòng lệnh).
 *   npm run grant-admin -- <email công ty>          (local)
 *   node dist/database/grant-admin.js <email>         (staging, chạy một lần trong container API)
 * Người đó phải có hồ sơ chưa nghỉ việc; tài khoản đăng nhập tạo luôn nếu chưa có (gắn `subject` ở lần đăng nhập đầu).
 */
import dataSource from './data-source';
import { writeOutbox } from '../messaging/outbox';

async function main() {
  const email = (process.argv[2] ?? '').trim().toLowerCase();
  if (!email.includes('@')) {
    console.error('Cách dùng: npm run grant-admin -- <email công ty>');
    process.exit(2);
  }
  await dataSource.initialize();
  try {
    await dataSource.transaction(async (m) => {
      const [emp] = await m.query(`SELECT id, status FROM employee.employee WHERE work_email = $1`, [email]);
      if (!emp) throw new Error(`Không có hồ sơ với email ${email}`);
      if (emp.status === 'TERMINATED') throw new Error('Nhân viên đã nghỉ việc');
      const [acc] = await m.query(
        `INSERT INTO iam.user_account (email, employee_id) VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE SET employee_id = COALESCE(iam.user_account.employee_id, EXCLUDED.employee_id)
         RETURNING id`,
        [email, emp.id],
      );
      const reason = 'Cấp ADMIN đầu tiên bằng lệnh grant-admin';
      const added = await m.query(
        `INSERT INTO iam.role_assignment (user_id, role, reason) VALUES ($1, 'ADMIN', $2) ON CONFLICT DO NOTHING RETURNING user_id`,
        [acc.id, reason],
      );
      if (!added.length) {
        console.log(`${email} đã là ADMIN, không đổi gì.`);
        return;
      }
      await m.query(
        `INSERT INTO audit.audit_log (actor_id, action, entity_type, entity_id, changed_fields) VALUES (NULL, 'ROLE_GRANT', 'role_assignment', $1, $2)`,
        [acc.id, JSON.stringify({ userId: acc.id, role: 'ADMIN', reason })],
      );
      await writeOutbox(m, 'RoleGranted', acc.id, { accountId: acc.id, email, role: 'ADMIN', occurredAt: new Date().toISOString() });
      console.log(`Đã cấp ADMIN cho ${email}.`);
    });
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
