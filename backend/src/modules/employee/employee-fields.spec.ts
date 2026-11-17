import { readFileSync } from 'fs';
import { join } from 'path';
import { CreateEmployeeDto, SELF_EDITABLE, UpdateEmployeeDto } from './employee.dto';

/**
 * Giữ bộ mô tả trường của frontend (frontend/src/pages/employee/employee-fields.ts) khớp với backend:
 * trường nhân viên tự sửa phải đúng SELF_EDITABLE, trường nào cũng phải có trong DTO tạo hoặc sửa.
 */
const source = readFileSync(join(__dirname, '../../../../frontend/src/pages/employee/employee-fields.ts'), 'utf8');
const defs = [...source.matchAll(/\{ key: '(\w+)'.*?editableBy: \[([^\]]*)\]/g)].map((m) => ({
  key: m[1],
  editableBy: m[2].split(',').map((s) => s.trim().replace(/'/g, '')),
}));

describe('employee-fields.ts (frontend) khớp backend', () => {
  it('đọc được bộ mô tả trường', () => {
    expect(defs.length).toBeGreaterThan(10);
  });

  it('trường nhân viên tự sửa (SELF) đúng bằng SELF_EDITABLE', () => {
    const self = defs.filter((d) => d.editableBy.includes('SELF')).map((d) => d.key).sort();
    expect(self).toEqual([...SELF_EDITABLE].sort());
  });

  it('mọi trường đều có trong DTO tạo hoặc sửa', () => {
    // Lấy tên thuộc tính từ metadata class-validator qua một instance rỗng không đủ; dùng danh sách khai báo trong DTO.
    const dtoSource = readFileSync(join(__dirname, 'employee.dto.ts'), 'utf8');
    const block = (name: string) => dtoSource.slice(dtoSource.indexOf(`export class ${name}`)).split('\n}')[0];
    const props = (name: string) => [...block(name).matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]);
    const known = new Set([...props(CreateEmployeeDto.name), ...props(UpdateEmployeeDto.name)]);
    expect(defs.filter((d) => !known.has(d.key)).map((d) => d.key)).toEqual([]);
  });
});
