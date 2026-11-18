import { auditFields } from './employee-audit';

describe('audit theo nhóm trường (AC-1.4.3)', () => {
  it('sửa: trường tổ chức có giá trị cũ và mới, trường cá nhân và nhạy cảm chỉ có tên', () => {
    const out = auditFields(
      { departmentId: 'd2', hireDate: '2020-01-02', phone: '0912', fullName: 'A', salary: '1000', nationalId: '0123' },
      { departmentId: 'd1', hireDate: '2020-01-01', phone: '0900', fullName: 'B' },
    );
    expect(out).toEqual({
      departmentId: { from: 'd1', to: 'd2' },
      hireDate: { from: '2020-01-01', to: '2020-01-02' },
      phone: '***',
      fullName: '***',
      salary: '***',
      nationalId: '***',
    });
  });

  it('tạo mới: trường tổ chức ghi giá trị, không lộ trường cá nhân', () => {
    const out = auditFields({ employeeCode: 'E00001', managerId: null, address: 'Hà Nội', workEmail: 'a@b.c' }, null);
    expect(out).toEqual({ employeeCode: 'E00001', managerId: null, address: '***', workEmail: '***' });
    expect(JSON.stringify(out)).not.toContain('Hà Nội');
  });
});
