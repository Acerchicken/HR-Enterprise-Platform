import { canView, checkDeclaredFile, matchesContent, MAX_FILE_BYTES, Viewer } from './document-rules';

const PDF = 'application/pdf';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const bytes = (s: string) => new Uint8Array(Buffer.from(s, 'latin1'));

describe('DR-01: file hợp lệ', () => {
  it('chỉ nhận PDF/DOCX, content type khớp phần mở rộng, tối đa 20 MiB', () => {
    expect(checkDeclaredFile('quy-che.pdf', PDF, 4 * 1024 * 1024)).toBeNull();
    expect(checkDeclaredFile('Mau.DOCX', DOCX, 1000)).toBeNull();
    expect(checkDeclaredFile('anh.png', 'image/png', 1000)).toMatch(/PDF hoặc DOCX/);
    expect(checkDeclaredFile('a.pdf', DOCX, 1000)).toMatch(/không khớp/);
    expect(checkDeclaredFile('a.pdf', PDF, MAX_FILE_BYTES + 1)).toMatch(/20 MiB/);
    expect(checkDeclaredFile('a.pdf', PDF, 0)).toMatch(/20 MiB/);
  });

  it('kiểm định dạng thực: file ZIP đổi tên thành .pdf hoặc .docx bị từ chối', () => {
    expect(matchesContent('a.pdf', bytes('%PDF-1.7\n...'))).toBe(true);
    expect(matchesContent('a.pdf', bytes('PK\x03\x04rest'))).toBe(false);
    expect(matchesContent('a.docx', bytes('PK\x03\x04....[Content_Types].xml....word/document.xml'))).toBe(true);
    expect(matchesContent('a.docx', bytes('PK\x03\x04....photos/1.jpg'))).toBe(false);
  });
});

describe('DR-02, DR-05: phạm vi xem', () => {
  const staff: Viewer = { active: true, departmentChain: ['web', 'eng', 'bod'], roles: ['EMPLOYEE'] };
  const doc = (p: Partial<{ scopeAll: boolean; departments: string[]; roles: string[]; hidden: boolean }>) => ({
    scopeAll: false, departments: [], roles: [], hidden: false, ...p,
  });

  it('toàn công ty: mọi nhân viên đang làm việc', () => {
    expect(canView(staff, doc({ scopeAll: true }))).toBe(true);
    expect(canView({ ...staff, active: false }, doc({ scopeAll: true }))).toBe(false);
  });

  it('phòng ban gồm phòng ban con: cấp cho khối Kỹ thuật thì nhân viên phòng Web thấy', () => {
    expect(canView(staff, doc({ departments: ['eng'] }))).toBe(true);
    expect(canView(staff, doc({ departments: ['hr'] }))).toBe(false);
  });

  it('nhiều phạm vi là phép cộng; vai trò không có thì không thấy', () => {
    expect(canView(staff, doc({ departments: ['hr'], roles: ['EMPLOYEE'] }))).toBe(true);
    expect(canView(staff, doc({ roles: ['HR'] }))).toBe(false);
  });

  it('tài liệu đã ẩn: không ai thấy', () => {
    expect(canView(staff, doc({ scopeAll: true, hidden: true }))).toBe(false);
  });
});
