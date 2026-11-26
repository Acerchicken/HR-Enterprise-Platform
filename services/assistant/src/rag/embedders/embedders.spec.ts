import { Embedder } from './embedder';
import { EmbeddingGemma } from './embeddinggemma';
import { HashEmbedder } from './hash';
import { createEmbedder, EMBEDDER_IDS, registerEmbedder } from './registry';

describe('EmbeddingGemma prompt', () => {
  it('câu hỏi và đoạn văn dùng đúng tiền tố của model', () => {
    expect(EmbeddingGemma.queryText('nghỉ cưới mấy ngày')).toBe('task: search result | query: nghỉ cưới mấy ngày');
    expect(EmbeddingGemma.documentText({ heading: 'Điều 5', text: 'Kết hôn: 3 ngày' })).toBe('title: Điều 5 | text: Kết hôn: 3 ngày');
    expect(EmbeddingGemma.documentText({ heading: '  ', text: 'x' })).toBe('title: none | text: x');
  });
});

describe('HashEmbedder', () => {
  it('vector chuẩn hóa, không phân biệt dấu', async () => {
    const e = new HashEmbedder(64);
    const [a] = await e.embedDocuments([{ heading: '', text: 'nghỉ cưới' }]);
    const b = await e.embedQuery('nghi cuoi');
    expect(a).toHaveLength(64);
    expect(a.reduce((s, x) => s + x * x, 0)).toBeCloseTo(1);
    expect(a).toEqual(b);
  });
});

describe('registry', () => {
  it('mặc định có EmbeddingGemma và hash-256', () => {
    expect(EMBEDDER_IDS).toEqual(expect.arrayContaining(['embeddinggemma-300m', 'hash-256']));
    expect(createEmbedder('embeddinggemma-300m', { cacheDir: '/tmp' }).dimensions).toBe(768);
  });

  it('model không có trong registry thì báo lỗi rõ', () => {
    expect(() => createEmbedder('khong-co', { cacheDir: '/tmp' })).toThrow(/không có trong registry/);
  });

  it('thêm model mới bằng một dòng đăng ký', async () => {
    const fake: Embedder = {
      id: 'fake-3',
      dimensions: 3,
      load: async () => undefined,
      embedQuery: async () => [1, 0, 0],
      embedDocuments: async (d) => d.map(() => [0, 1, 0]),
    };
    registerEmbedder('fake-3', () => fake);
    expect(createEmbedder('fake-3', { cacheDir: '/tmp' })).toBe(fake);
  });
});
