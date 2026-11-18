import { checkDeclared, checkQuota, matchesContent, MiB } from './profile-file-rules';

const bytes = (...b: number[]) => new Uint8Array(b);

describe('file hồ sơ (AC-1.10.1, 1.10.2, 1.10.3, 1.10.8)', () => {
  it('nhận PDF, DOCX, JPG, PNG đến 10 MiB; khai báo sai thì từ chối', () => {
    expect(checkDeclared('cv', 'cv.pdf', 'application/pdf', 1)).toBeNull();
    expect(checkDeclared('cv', 'anh.PNG', 'image/png', 10 * MiB)).toBeNull();
    expect(checkDeclared('cv', 'cv.pdf', 'application/pdf', 10 * MiB + 1)).toMatch(/10 MiB/);
    expect(checkDeclared('cv', 'cv.exe', 'application/octet-stream', 10)).toMatch(/Chỉ nhận/);
    expect(checkDeclared('cv', 'cv.pdf', 'image/png', 10)).toMatch(/không khớp/);
    expect(checkDeclared('salary', 'x.pdf', 'application/pdf', 10)).toMatch(/không nhận file/);
  });

  it('ảnh đại diện chỉ JPG, PNG đến 2 MiB', () => {
    expect(checkDeclared('avatar', 'a.jpg', 'image/jpeg', 2 * MiB)).toBeNull();
    expect(checkDeclared('avatar', 'a.jpg', 'image/jpeg', 2 * MiB + 1)).toMatch(/2 MiB/);
    expect(checkDeclared('avatar', 'a.pdf', 'application/pdf', 10)).toMatch(/JPG, PNG/);
  });

  it('nội dung phải khớp đuôi: ZIP đổi đuôi .pdf, EXE đổi đuôi .jpg bị từ chối', () => {
    expect(matchesContent('a.pdf', bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31))).toBe(true);
    expect(matchesContent('a.pdf', bytes(0x50, 0x4b, 0x03, 0x04))).toBe(false);
    expect(matchesContent('a.jpg', bytes(0x4d, 0x5a, 0x90, 0x00))).toBe(false);
    expect(matchesContent('a.png', bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe(true);
    const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('xx/readme.txt')]);
    expect(matchesContent('a.docx', zip)).toBe(false);
    expect(matchesContent('a.docx', Buffer.concat([zip, Buffer.from('word/document.xml')]))).toBe(true);
  });

  it('hạn mức 50 file, 200 MiB', () => {
    expect(checkQuota(49, 0, 1)).toBeNull();
    expect(checkQuota(50, 0, 1)).toMatch(/50 file/);
    expect(checkQuota(10, 199 * MiB, 2 * MiB)).toMatch(/200 MiB/);
  });
});
