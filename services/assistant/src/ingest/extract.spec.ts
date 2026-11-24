import { makeDocx, makePdf } from '../test-support/fixtures';
import { DOCX, ExtractError, extractSections, PDF } from './extract';
import { cleanText, looksLikeHeading } from './text';

describe('text', () => {
  it('cleanText chuẩn hóa NFC, bỏ ký tự ẩn và gộp khoảng trắng', () => {
    expect(cleanText('Nghỉ  phép​\tnăm')).toBe('Nghỉ phép năm');
  });

  it('looksLikeHeading nhận Chương, Mục, Điều có số', () => {
    expect(looksLikeHeading('Điều 5. Nghỉ việc riêng')).toBe(true);
    expect(looksLikeHeading('Chương II')).toBe(true);
    expect(looksLikeHeading('Điều chỉnh lương theo năm')).toBe(false);
  });
});

describe('extractSections', () => {
  it('DOCX: tiêu đề Heading và dòng "Điều n" mở mục mới', async () => {
    const file = await makeDocx([
      { text: 'Quy chế nghỉ phép', h: true },
      { text: 'Áp dụng cho toàn công ty.' },
      { text: 'Điều 5. Nghỉ việc riêng' },
      { text: 'Kết hôn: nghỉ 3 ngày & hưởng lương.' },
    ]);
    const sections = await extractSections(file, DOCX);
    expect(sections).toEqual([
      { heading: 'Quy chế nghỉ phép', paragraphs: ['Quy chế nghỉ phép', 'Áp dụng cho toàn công ty.'] },
      { heading: 'Điều 5. Nghỉ việc riêng', paragraphs: ['Điều 5. Nghỉ việc riêng', 'Kết hôn: nghỉ 3 ngày & hưởng lương.'] },
    ]);
  });

  it('PDF: ghi số trang vào tiêu đề, nối dòng bị ngắt thành đoạn', async () => {
    const file = makePdf([
      ['Dieu 1. Pham vi', 'Quy che nay ap dung cho', 'toan bo nhan vien.'],
      ['Noi dung trang hai.'],
    ]);
    const sections = await extractSections(file, PDF);
    expect(sections).toEqual([
      { heading: 'Dieu 1. Pham vi (trang 1)', paragraphs: ['Dieu 1. Pham vi', 'Quy che nay ap dung cho toan bo nhan vien.'] },
      { heading: 'Dieu 1. Pham vi (trang 2)', paragraphs: ['Noi dung trang hai.'] },
    ]);
  });

  it('PDF không có chữ thì ném ExtractError', async () => {
    await expect(extractSections(makePdf([[]]), PDF)).rejects.toBeInstanceOf(ExtractError);
  });

  it('file hỏng, định dạng lạ thì ném ExtractError', async () => {
    await expect(extractSections(Buffer.from('not a pdf'), PDF)).rejects.toBeInstanceOf(ExtractError);
    await expect(extractSections(Buffer.from('not a zip'), DOCX)).rejects.toBeInstanceOf(ExtractError);
    await expect(extractSections(Buffer.from('x'), 'text/plain')).rejects.toBeInstanceOf(ExtractError);
  });
});
