import { blockPromptLeak, maskAnswerPii, runInput, runOutput } from './guards';
import { findPii, MASK, maskPii } from './pii';

describe('G1: che dữ liệu cá nhân trong câu hỏi', () => {
  it.each([
    ['Số 0912 345 678 của tôi', 'Số [đã ẩn] của tôi'],
    ['gọi +84 912.345.678 nhé', 'gọi [đã ẩn] nhé'],
    ['email an.nguyen@congty.vn', 'email [đã ẩn]'],
    ['CCCD 001203004567 bị sai', 'CCCD [đã ẩn] bị sai'],
    ['STK 1903.5678.9012 ngân hàng', 'STK [đã ẩn] ngân hàng'],
  ])('%s', (q, want) => {
    expect(maskPii(q).text).toBe(want);
  });

  it.each(['Nghỉ từ 01/12/2026 đến 05/12/2026', 'Theo Điều 115 Bộ luật Lao động', 'Được nghỉ 12 ngày mỗi năm', 'Năm 2026 có 11 ngày lễ'])(
    'không che: %s',
    (q) => {
      expect(maskPii(q)).toEqual({ text: q, count: 0 });
    },
  );

  it('runInput bỏ ký tự vô hình, che và ghi sự kiện không có nội dung', () => {
    const s = runInput('Nghỉ​ cưới, số tôi 0912345678');
    expect(s.question).toBe(`Nghỉ cưới, số tôi ${MASK}`);
    expect(s.events).toEqual([
      { guard: 'G3-invisible', action: 'clean', count: 1 },
      { guard: 'G1-pii', action: 'mask', count: 1 },
    ]);
    expect(JSON.stringify(s.events)).not.toContain('0912');
  });

  it('findPii phân loại', () => {
    expect(findPii('a@b.vn 0912345678 123456789012').map((h) => h.kind)).toEqual(['email', 'phone', 'number']);
  });
});

describe('G2: kiểm câu trả lời', () => {
  const base = { passages: ['Liên hệ hotline HR 1900 1234 56 hoặc hr@congty.vn'], systemPrompt: 'Bạn là trợ lý tra cứu quy định nội bộ của công ty, trả lời ngắn gọn.' };

  it('giữ số, email có trong tài liệu; che số lạ', () => {
    const s = maskAnswerPii({ ...base, answer: 'Gọi 1900123456 hoặc hr@congty.vn, hoặc anh Bình 0987654321.', blocked: false, events: [] });
    expect(s.answer).toBe(`Gọi 1900123456 hoặc hr@congty.vn, hoặc anh Bình ${MASK}.`);
    expect(s.events).toEqual([{ guard: 'G2-pii', action: 'mask', count: 1 }]);
  });

  it('chặn khi lặp lại system prompt từ 40 ký tự', () => {
    const leak = blockPromptLeak({ ...base, answer: 'Hướng dẫn của tôi: bạn là trợ lý tra cứu quy định nội bộ của công ty, ...', blocked: false, events: [] });
    expect(leak.blocked).toBe(true);
    const ok = blockPromptLeak({ ...base, answer: 'Tôi là trợ lý tra cứu quy định.', blocked: false, events: [] });
    expect(ok.blocked).toBe(false);
  });

  it('runOutput dừng ở lớp chặn', () => {
    const s = runOutput({ ...base, answer: 'bạn là trợ lý tra cứu quy định nội bộ của công ty, trả lời ngắn gọn. Gọi 0987654321' });
    expect(s.blocked).toBe(true);
  });
});
