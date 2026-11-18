import { validateSection } from './profile-schema';

const TODAY = '2026-11-15';

describe('kiểm dữ liệu đề xuất theo mục (AC-1.9.9, spec mục 8)', () => {
  it('liên hệ khẩn cấp hợp lệ; trường lạ bị bỏ', () => {
    const v = validateSection('emergency-contacts', { fullName: 'Lê Văn B', relation: 'Cha', phone: '0912 345 678', hack: 1 }, TODAY);
    expect(v.errors).toEqual({});
    expect(v.data).toEqual({ fullName: 'Lê Văn B', relation: 'Cha', phone: '0912 345 678' });
  });

  it('thiếu trường bắt buộc, sai mẫu điện thoại, quan hệ ngoài danh sách', () => {
    const v = validateSection('emergency-contacts', { fullName: 'A', relation: 'Bạn', phone: 'abc' }, TODAY);
    expect(Object.keys(v.errors).sort()).toEqual(['fullName', 'phone', 'relation']);
  });

  it('người phụ thuộc bắt buộc mã số thuế (tách ra để mã hóa) và từ tháng; ngày sinh không ở tương lai', () => {
    const base = { fullName: 'Trần Văn C', relation: 'Con', dateOfBirth: '2030-01-01', isDependent: true };
    const bad = validateSection('relatives', base, TODAY);
    expect(Object.keys(bad.errors).sort()).toEqual(['dateOfBirth', 'dependentFrom', 'taxId']);
    const ok = validateSection('relatives', { ...base, dateOfBirth: '2015-05-01', taxId: '0123456789', dependentFrom: '2026-01' }, TODAY);
    expect(ok.errors).toEqual({});
    expect(ok.sensitive).toEqual({ taxId: '0123456789' });
    expect(ok.data).not.toHaveProperty('taxId');
  });

  it('không phải người phụ thuộc thì bỏ qua mã số thuế', () => {
    const v = validateSection('relatives', { fullName: 'Trần Văn C', relation: 'Con', dateOfBirth: '2015-05-01', isDependent: false, taxId: '1' }, TODAY);
    expect(v.errors).toEqual({});
    expect(v.sensitive).toEqual({});
  });

  it('chứng chỉ: hết hạn phải sau ngày cấp; bằng cấp: năm trong khoảng 1950 → năm nay', () => {
    expect(validateSection('qualifications', { kind: 'CERTIFICATE', certName: 'IELTS', issuedDate: '2025-01-01', expiryDate: '2024-01-01' }, TODAY).errors).toEqual({
      expiryDate: 'Ngày hết hạn phải sau ngày cấp',
    });
    expect(validateSection('qualifications', { kind: 'DEGREE', level: 'Đại học', graduationYear: 2027 }, TODAY).errors).toHaveProperty('graduationYear');
  });

  it('tài khoản ngân hàng: số tài khoản nhạy cảm, chủ tài khoản viết hoa không dấu', () => {
    const v = validateSection('bank-account', { bankName: 'BIDV', accountNumber: '12345678', holder: 'nguyen van an' }, TODAY);
    expect(v.errors).toEqual({});
    expect(v.data.holder).toBe('NGUYEN VAN AN');
    expect(v.sensitive).toEqual({ accountNumber: '12345678' });
    expect(validateSection('bank-account', { bankName: 'BIDV', accountNumber: '12', holder: 'Nguyễn' }, TODAY).errors).toHaveProperty('holder');
  });

  it('trường chính chỉ nhận điện thoại, địa chỉ; sửa một phần không bắt các trường còn lại', () => {
    const v = validateSection('personal', { phone: '0912 000 111' }, TODAY, true);
    expect(v).toEqual({ data: { phone: '0912 000 111' }, sensitive: {}, errors: {} });
    expect(validateSection('nope', {}, TODAY).errors).toHaveProperty('section');
  });

  it('mục HR quản lý: hợp đồng không thời hạn không cần ngày kết thúc; lương là số dương (FR-1.12)', () => {
    expect(validateSection('contracts', { type: 'INDEFINITE', number: 'HĐ-01', startDate: '2026-01-01' }, TODAY).errors).toEqual({});
    expect(validateSection('contracts', { type: 'FIXED_TERM', number: 'HĐ-02', startDate: '2026-01-01' }, TODAY).errors).toHaveProperty('endDate');
    expect(validateSection('contracts', { type: 'FIXED_TERM', number: 'HĐ-02', startDate: '2026-01-01', endDate: '2025-01-01' }, TODAY).errors).toHaveProperty('endDate');
    const salary = validateSection('salary', { amount: '25000000', effectiveDate: '2026-01-01' }, TODAY);
    expect(salary).toMatchObject({ errors: {}, sensitive: { amount: '25000000' } });
    expect(validateSection('salary', { amount: '0', effectiveDate: '2026-01-01' }, TODAY).errors).toHaveProperty('amount');
  });
});
