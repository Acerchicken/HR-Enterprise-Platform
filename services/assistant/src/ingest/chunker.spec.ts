import { chunkSections } from './chunker';

describe('chunkSections', () => {
  it('gom đoạn văn ngắn vào một đoạn, giữ tiêu đề mục', () => {
    const chunks = chunkSections([{ heading: 'Điều 1', paragraphs: ['a b c', 'd e f'] }], 100, 10);
    expect(chunks).toEqual([{ ord: 0, heading: 'Điều 1', content: 'a b c\nd e f' }]);
  });

  it('không cho đoạn vượt qua ranh giới mục, ord tăng liên tục', () => {
    const chunks = chunkSections(
      [
        { heading: 'Điều 1', paragraphs: ['x'.repeat(10)] },
        { heading: 'Điều 2', paragraphs: ['y'.repeat(10)] },
      ],
      100,
      10,
    );
    expect(chunks.map((c) => [c.ord, c.heading])).toEqual([
      [0, 'Điều 1'],
      [1, 'Điều 2'],
    ]);
  });

  it('đoạn sau chồng phần cuối của đoạn trước, mọi đoạn không dài quá size', () => {
    const words = Array.from({ length: 200 }, (_, i) => `w${i}`);
    const paragraphs = Array.from({ length: 20 }, (_, i) => words.slice(i * 10, i * 10 + 10).join(' ') + '.');
    const chunks = chunkSections([{ heading: 'H', paragraphs }], 120, 30);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.content.length).toBeLessThanOrEqual(120);
    for (let i = 1; i < chunks.length; i++) {
      const prevLast = chunks[i - 1].content.split(/\s+/).pop()!;
      expect(chunks[i].content).toContain(prevLast);
    }
    // Không mất từ nào.
    const all = chunks.map((c) => c.content).join(' ');
    for (const w of words) expect(all).toContain(w);
  });

  it('cắt đoạn văn quá dài theo câu rồi theo từ', () => {
    const longSentence = Array.from({ length: 60 }, (_, i) => `tu${i}`).join(' ');
    const chunks = chunkSections([{ heading: '', paragraphs: [`Câu một ngắn. ${longSentence}`] }], 50, 0);
    for (const c of chunks) expect(c.content.length).toBeLessThanOrEqual(50);
    expect(chunks[0].content).toBe('Câu một ngắn.');
    expect(chunks.map((c) => c.content).join(' ')).toContain('tu59');
  });

  it('bỏ mục rỗng', () => {
    expect(chunkSections([{ heading: 'H', paragraphs: [] }], 100, 10)).toEqual([]);
  });
});
