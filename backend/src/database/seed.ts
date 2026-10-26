/**
 * Dữ liệu mẫu: 25 phòng ban / 3 văn phòng, 9 chức danh, 2,000 nhân viên giả lập
 * (≈150 quản lý), trường nhạy cảm đã mã hóa, loại phép + số dư năm hiện tại,
 * và 4 tài khoản demo khớp với realm Keycloak (xem keycloak/realm-hr.json).
 *
 *   npm run seed            # bỏ qua nếu đã có dữ liệu
 *   npm run seed -- --reset # xóa dữ liệu cũ rồi tạo lại
 *
 * Dùng seed cố định nên mỗi lần chạy ra cùng một bộ dữ liệu → cả nhóm test giống nhau.
 */
import { fakerVI as faker } from '@faker-js/faker';
import { randomUUID } from 'crypto';
import { FieldCrypto } from '../common/field-crypto';
import { loadConfig } from '../config/config';
import dataSource from './data-source';

export const TOTAL_EMPLOYEES = Number(process.env.SEED_EMPLOYEES ?? 2000);

export const DEMO_ACCOUNTS = {
  employee: 'employee@hr.local',
  manager: 'manager@hr.local',
  hr: 'hr@hr.local',
  admin: 'admin@hr.local',
} as const;

const OFFICES = ['Hà Nội', 'TP.HCM', 'Đà Nẵng'];

// [code, tên, văn phòng, mã phòng ban cha]
const DEPARTMENTS: [string, string, string, string | null][] = [
  ['BOD', 'Ban Giám đốc', 'Hà Nội', null],
  ['ENG', 'Khối Công nghệ', 'Hà Nội', 'BOD'],
  ['ENG-PLT', 'Platform Engineering', 'Hà Nội', 'ENG'],
  ['ENG-WEB', 'Web Engineering', 'Hà Nội', 'ENG'],
  ['ENG-MOB', 'Mobile Engineering', 'TP.HCM', 'ENG'],
  ['ENG-QA', 'Quality Assurance', 'Đà Nẵng', 'ENG'],
  ['ENG-DATA', 'Data & AI', 'Hà Nội', 'ENG'],
  ['IT', 'IT nội bộ', 'Hà Nội', 'ENG'],
  ['HR', 'Khối Nhân sự', 'Hà Nội', 'BOD'],
  ['HR-REC', 'Tuyển dụng', 'TP.HCM', 'HR'],
  ['HR-CB', 'C&B (Lương thưởng)', 'Hà Nội', 'HR'],
  ['HR-LD', 'Đào tạo & Phát triển', 'Đà Nẵng', 'HR'],
  ['FIN', 'Khối Tài chính', 'Hà Nội', 'BOD'],
  ['FIN-ACC', 'Kế toán', 'Hà Nội', 'FIN'],
  ['FIN-PLAN', 'Kế hoạch tài chính', 'TP.HCM', 'FIN'],
  ['SAL', 'Khối Kinh doanh', 'TP.HCM', 'BOD'],
  ['SAL-N', 'Kinh doanh miền Bắc', 'Hà Nội', 'SAL'],
  ['SAL-S', 'Kinh doanh miền Nam', 'TP.HCM', 'SAL'],
  ['SAL-C', 'Kinh doanh miền Trung', 'Đà Nẵng', 'SAL'],
  ['MKT', 'Marketing', 'TP.HCM', 'BOD'],
  ['CS', 'Chăm sóc khách hàng', 'Đà Nẵng', 'BOD'],
  ['CS-HL', 'Hotline', 'Đà Nẵng', 'CS'],
  ['OPS', 'Vận hành', 'TP.HCM', 'BOD'],
  ['OPS-LOG', 'Hậu cần', 'TP.HCM', 'OPS'],
  ['LEG', 'Pháp chế', 'Hà Nội', 'BOD'],
];

// [code, title, level, lương cơ bản (triệu VND)]
const POSITIONS: [string, string, number, number][] = [
  ['CEO', 'Tổng Giám đốc', 10, 150],
  ['DIR', 'Giám đốc khối', 8, 80],
  ['HEAD', 'Trưởng phòng', 7, 55],
  ['LEAD', 'Trưởng nhóm', 6, 40],
  ['SR', 'Chuyên viên cao cấp', 5, 30],
  ['STAFF', 'Chuyên viên', 4, 20],
  ['JR', 'Nhân viên', 3, 13],
  ['HRS', 'Chuyên viên nhân sự', 4, 18],
  ['INT', 'Thực tập sinh', 1, 5],
];

const LEAVE_TYPES: [string, string, number][] = [
  ['ANNUAL', 'Nghỉ phép năm', 12],
  ['SICK', 'Nghỉ ốm', 30],
  ['MARRIAGE', 'Nghỉ cưới', 3],
  ['UNPAID', 'Nghỉ không lương', 30],
];

const STREETS = ['Láng Hạ', 'Trần Duy Hưng', 'Nguyễn Trãi', 'Lê Lợi', 'Hai Bà Trưng', 'Nguyễn Huệ', 'Bạch Đằng', 'Phan Chu Trinh', 'Cầu Giấy', 'Điện Biên Phủ'];

interface SeedEmployee {
  id: string;
  employee_code: string;
  full_name: string;
  work_email: string;
  phone: string;
  date_of_birth: string;
  address: string;
  department_id: string;
  position_id: string;
  manager_id: string | null;
  hire_date: string;
  status: string;
}

function slug(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z]+/g, '.')
    .replace(/^\.|\.$/g, '');
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  const reset = process.argv.includes('--reset');
  faker.seed(2026);
  const cfg = loadConfig();
  const crypto = new FieldCrypto(cfg.fieldEncryptionKey);
  await dataSource.initialize();

  const [{ count }] = await dataSource.query('SELECT count(*)::int AS count FROM employee.employee');
  if (count > 0 && !reset) {
    console.log(`Đã có ${count} nhân viên, bỏ qua. Dùng "npm run seed -- --reset" để tạo lại.`);
    await dataSource.destroy();
    return;
  }

  await dataSource.transaction(async (m) => {
    if (reset) {
      // audit_log là append-only (trigger chặn DELETE) nên dùng TRUNCATE – chỉ dành cho môi trường dev.
      await m.query(`TRUNCATE audit.audit_log, leave.leave_request_history, leave.leave_request, leave.leave_balance,
        leave.leave_type, iam.role_assignment, iam.user_account, employee.employee_sensitive, employee.employee,
        org.position, org.department RESTART IDENTITY CASCADE`);
    }

    // ---- Phòng ban & chức danh ----
    const deptId = new Map<string, string>();
    for (const [code] of DEPARTMENTS) deptId.set(code, randomUUID());
    await m.query(
      `INSERT INTO org.department (id, code, name, office, parent_id)
       SELECT * FROM unnest($1::uuid[], $2::text[], $3::text[], $4::text[], $5::uuid[])`,
      [
        DEPARTMENTS.map(([c]) => deptId.get(c)),
        DEPARTMENTS.map(([c]) => c),
        DEPARTMENTS.map(([, n]) => n),
        DEPARTMENTS.map(([, , o]) => o),
        DEPARTMENTS.map(([, , , p]) => (p ? deptId.get(p) : null)),
      ],
    );
    const posId = new Map<string, string>();
    for (const [code] of POSITIONS) posId.set(code, randomUUID());
    await m.query(
      `INSERT INTO org.position (id, code, title, level) SELECT * FROM unnest($1::uuid[], $2::text[], $3::text[], $4::int[])`,
      [POSITIONS.map(([c]) => posId.get(c)), POSITIONS.map(([c]) => c), POSITIONS.map(([, t]) => t), POSITIONS.map(([, , l]) => l)],
    );
    const baseSalary = new Map(POSITIONS.map(([c, , , s]) => [c, s]));

    // ---- Nhân viên: CEO → giám đốc khối / trưởng phòng → trưởng nhóm → nhân viên ----
    const employees: SeedEmployee[] = [];
    const positionOf = new Map<string, string>();
    const usedEmails = new Set<string>();
    const make = (dept: string, pos: string, managerId: string | null, email?: string, name?: string): SeedEmployee => {
      const n = employees.length + 1;
      const fullName = name ?? `${faker.person.lastName()} ${faker.person.firstName()}`;
      let workEmail = email ?? `${slug(fullName)}@hr.local`;
      if (usedEmails.has(workEmail)) workEmail = workEmail.replace('@', `${n}@`);
      usedEmails.add(workEmail);
      const e: SeedEmployee = {
        id: randomUUID(),
        employee_code: `E${String(n).padStart(5, '0')}`,
        full_name: fullName,
        work_email: workEmail,
        phone: `09${faker.string.numeric(8)}`,
        date_of_birth: isoDate(faker.date.birthdate({ min: 22, max: 58, mode: 'age' })),
        address: `${faker.number.int({ min: 1, max: 300 })} ${faker.helpers.arrayElement(STREETS)}, ${DEPARTMENTS.find(([c]) => c === dept)![2]}`,
        department_id: deptId.get(dept)!,
        position_id: posId.get(pos)!,
        manager_id: managerId,
        hire_date: isoDate(faker.date.between({ from: '2015-01-01', to: '2026-09-30' })),
        status: faker.helpers.weightedArrayElement([
          { weight: 96, value: 'ACTIVE' },
          { weight: 3, value: 'ON_LEAVE' },
          { weight: 1, value: 'TERMINATED' },
        ]),
      };
      if (managerId === null || pos === 'HEAD' || pos === 'DIR' || pos === 'LEAD') e.status = 'ACTIVE';
      employees.push(e);
      positionOf.set(e.id, pos);
      return e;
    };

    const ceo = make('BOD', 'CEO', null);
    const headOf = new Map<string, SeedEmployee>([['BOD', ceo]]);
    for (const [code, , , parent] of DEPARTMENTS) {
      if (!parent) continue;
      const isDivision = DEPARTMENTS.some(([, , , p]) => p === code);
      headOf.set(code, make(code, isDivision ? 'DIR' : 'HEAD', headOf.get(parent)!.id));
    }

    // Tài khoản demo đặt ở vị trí cố định để dễ thử phân quyền.
    const demoManager = make('ENG-WEB', 'LEAD', headOf.get('ENG-WEB')!.id, DEMO_ACCOUNTS.manager, 'Nguyễn Văn Quản');
    make('ENG-WEB', 'STAFF', demoManager.id, DEMO_ACCOUNTS.employee, 'Trần Thị Nhân');
    const demoHr = make('HR-CB', 'HRS', headOf.get('HR-CB')!.id, DEMO_ACCOUNTS.hr, 'Lê Thu Hằng');
    const demoAdmin = make('IT', 'SR', headOf.get('IT')!.id, DEMO_ACCOUNTS.admin, 'Phạm Minh Quân');

    // Trưởng nhóm: 8 mỗi phòng ban lá (khối HR chỉ 1, vì HR chỉ ~15 người).
    // Cùng 25 trưởng phòng/giám đốc → ≈150 quản lý như bảng Users & stakeholders tuần 5.
    const leafDepts = DEPARTMENTS.filter(([c]) => !DEPARTMENTS.some(([, , , p]) => p === c) && c !== 'BOD').map(([c]) => c);
    const leads: { weight: number; value: SeedEmployee }[] = [{ weight: 1, value: demoManager }];
    for (const dept of leafDepts) {
      const isHr = dept.startsWith('HR');
      const count = isHr ? 1 : dept === 'ENG-WEB' ? 7 : 8;
      for (let i = 0; i < count; i++) {
        leads.push({ weight: isHr ? 0.25 : 1, value: make(dept, 'LEAD', headOf.get(dept)!.id) });
      }
    }

    // Nhân viên còn lại chia cho các trưởng nhóm (khối HR nhận ít hơn).
    const deptCode = new Map([...deptId].map(([c, id]) => [id, c]));
    while (employees.length < TOTAL_EMPLOYEES) {
      const lead = faker.helpers.weightedArrayElement(leads);
      const code = deptCode.get(lead.department_id)!;
      const pos = code.startsWith('HR')
        ? 'HRS'
        : faker.helpers.weightedArrayElement([
            { weight: 20, value: 'SR' },
            { weight: 45, value: 'STAFF' },
            { weight: 28, value: 'JR' },
            { weight: 7, value: 'INT' },
          ]);
      make(code, pos, lead.id);
    }

    // Trưởng phòng gắn với phòng ban (head_employee_id).
    for (const [code, head] of headOf) {
      await m.query('UPDATE org.department SET head_employee_id = $1 WHERE id = $2', [head.id, deptId.get(code)]);
    }

    // Insert theo thứ tự (quản lý trước nhân viên) vì manager_id có FK tự tham chiếu.
    const cols = Object.keys(employees[0]) as (keyof SeedEmployee)[];
    for (let i = 0; i < employees.length; i += 500) {
      const batch = employees.slice(i, i + 500);
      await m.query(
        `INSERT INTO employee.employee (${cols.join(', ')})
         SELECT * FROM unnest($1::uuid[], $2::text[], $3::text[], $4::text[], $5::text[], $6::date[], $7::text[],
                              $8::uuid[], $9::uuid[], $10::uuid[], $11::date[], $12::text[])`,
        cols.map((c) => batch.map((e) => e[c])),
      );
    }

    // ---- Trường nhạy cảm (mã hóa) ----
    const sens = employees.map((e) => {
      const base = baseSalary.get(positionOf.get(e.id)!)!;
      const salary = Math.round(base * faker.number.float({ min: 0.9, max: 1.4 }) * 100) * 10_000;
      return [
        e.id,
        crypto.encrypt(faker.string.numeric(12)),
        crypto.encrypt(faker.finance.accountNumber(12)),
        crypto.encrypt(String(salary)),
      ];
    });
    for (let i = 0; i < sens.length; i += 500) {
      const b = sens.slice(i, i + 500);
      await m.query(
        `INSERT INTO employee.employee_sensitive (employee_id, national_id_enc, bank_account_enc, salary_enc)
         SELECT * FROM unnest($1::uuid[], $2::text[], $3::text[], $4::text[])`,
        [0, 1, 2, 3].map((k) => b.map((r) => r[k])),
      );
    }

    // ---- Loại phép & số dư năm hiện tại ----
    const typeId = new Map<string, string>();
    for (const [code, name, max] of LEAVE_TYPES) {
      const [row] = await m.query(
        'INSERT INTO leave.leave_type (code, name, max_days_per_year) VALUES ($1, $2, $3) RETURNING id',
        [code, name, max],
      );
      typeId.set(code, row.id);
    }
    const year = new Date().getFullYear();
    const active = employees.filter((e) => e.status !== 'TERMINATED');
    // Phép năm: 12 ngày + 1 ngày cho mỗi 5 năm thâm niên (theo Bộ luật Lao động).
    const annual = active.map((e) => 12 + Math.floor((year - Number(e.hire_date.slice(0, 4))) / 5));
    await m.query(
      `INSERT INTO leave.leave_balance (employee_id, leave_type_id, year, entitled, used)
       SELECT unnest($1::uuid[]), $2::uuid, $3::int, unnest($4::numeric[]), unnest($5::numeric[])`,
      [active.map((e) => e.id), typeId.get('ANNUAL'), year, annual, annual.map((a) => faker.number.int({ min: 0, max: Math.min(8, a) }))],
    );
    await m.query(
      `INSERT INTO leave.leave_balance (employee_id, leave_type_id, year, entitled, used)
       SELECT unnest($1::uuid[]), $2::uuid, $3::int, 30, 0`,
      [active.map((e) => e.id), typeId.get('SICK'), year],
    );

    // ---- Tài khoản demo có role đặc biệt (HR, ADMIN). EMPLOYEE/MANAGER tự suy ra khi đăng nhập. ----
    for (const [email, empId, role] of [
      [DEMO_ACCOUNTS.hr, demoHr.id, 'HR'],
      [DEMO_ACCOUNTS.admin, demoAdmin.id, 'ADMIN'],
    ] as const) {
      const [acc] = await m.query('INSERT INTO iam.user_account (email, employee_id) VALUES ($1, $2) RETURNING id', [email, empId]);
      await m.query('INSERT INTO iam.role_assignment (user_id, role) VALUES ($1, $2)', [acc.id, role]);
    }
    // Các nhân viên thuộc khối HR khác cũng có role HR.
    const hrDeptIds = DEPARTMENTS.filter(([c]) => c.startsWith('HR')).map(([c]) => deptId.get(c));
    const hrStaff = employees.filter((e) => hrDeptIds.includes(e.department_id) && e.id !== demoHr.id);
    for (const e of hrStaff) {
      const [acc] = await m.query('INSERT INTO iam.user_account (email, employee_id) VALUES ($1, $2) RETURNING id', [e.work_email, e.id]);
      await m.query("INSERT INTO iam.role_assignment (user_id, role) VALUES ($1, 'HR')", [acc.id]);
    }

    const managers = new Set(employees.map((e) => e.manager_id).filter(Boolean)).size;
    console.log(
      `Seed xong: ${DEPARTMENTS.length} phòng ban, ${POSITIONS.length} chức danh, ${employees.length} nhân viên ` +
        `(${managers} quản lý, ${hrStaff.length + 1} HR), ${OFFICES.length} văn phòng.`,
    );
  });
  await dataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
