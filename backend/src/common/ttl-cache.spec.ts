import { TtlCache } from './ttl-cache';

describe('TtlCache', () => {
  it('trả giá trị cache cho đến khi hết TTL', async () => {
    let t = 0;
    const cache = new TtlCache<number>(1000, () => t);
    const loader = jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);

    expect(await cache.getOrLoad('k', loader)).toBe(1);
    t = 999;
    expect(await cache.getOrLoad('k', loader)).toBe(1);
    t = 1000;
    expect(await cache.getOrLoad('k', loader)).toBe(2);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('clear() buộc đọc lại', async () => {
    const cache = new TtlCache<number>(60_000);
    const loader = jest.fn().mockResolvedValue(1);
    await cache.getOrLoad('k', loader);
    cache.clear();
    await cache.getOrLoad('k', loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
