import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tuần 8 – workflow nghỉ phép:
 * - leave.holiday: ngày nghỉ lễ không trừ phép (BR-03), dữ liệu 2026 theo docs/business/leave-types-holidays.md.
 * - leave_request.half_day: nghỉ nửa ngày buổi sáng/chiều (BR-04).
 * - leave_request.approver_id cho phép NULL: đơn vẫn ở SUBMITTED khi nhân viên chưa có người duyệt hợp lệ (BR-06);
 *   cột ghi người đã ra quyết định.
 */
export class LeaveWorkflow1730200000000 implements MigrationInterface {
  name = 'LeaveWorkflow1730200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE leave.holiday (
        holiday_date date PRIMARY KEY,
        name         varchar(100) NOT NULL
      )`);
    await q.query(`
      INSERT INTO leave.holiday (holiday_date, name) VALUES
        ('2026-01-01', 'Tết Dương lịch'),
        ('2026-02-16', 'Tết Nguyên đán'),
        ('2026-02-17', 'Tết Nguyên đán'),
        ('2026-02-18', 'Tết Nguyên đán'),
        ('2026-02-19', 'Tết Nguyên đán'),
        ('2026-02-20', 'Tết Nguyên đán'),
        ('2026-04-26', 'Giỗ Tổ Hùng Vương'),
        ('2026-04-27', 'Nghỉ bù Giỗ Tổ Hùng Vương'),
        ('2026-04-30', 'Ngày Chiến thắng'),
        ('2026-05-01', 'Quốc tế Lao động'),
        ('2026-09-01', 'Quốc khánh'),
        ('2026-09-02', 'Quốc khánh'),
        ('2026-11-24', 'Ngày Văn hóa Việt Nam')`);

    await q.query(`
      ALTER TABLE leave.leave_request
        ADD COLUMN half_day varchar(2) CHECK (half_day IN ('AM','PM')),
        ADD CONSTRAINT ck_leave_request_half_day_single CHECK (half_day IS NULL OR start_date = end_date),
        ALTER COLUMN approver_id DROP NOT NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE leave.leave_request SET approver_id = employee_id WHERE approver_id IS NULL`);
    await q.query(`
      ALTER TABLE leave.leave_request
        ALTER COLUMN approver_id SET NOT NULL,
        DROP CONSTRAINT ck_leave_request_half_day_single,
        DROP COLUMN half_day`);
    await q.query(`DROP TABLE leave.holiday`);
  }
}
