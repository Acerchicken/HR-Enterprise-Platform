import { withRetry } from './retry';

describe('withRetry (NFR-3.5)', () => {
  const quiet = () => jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  afterEach(() => jest.restoreAllMocks());

  it('lỗi tạm thời rồi thành công: chờ 1 s, 2 s (gấp đôi mỗi lần)', async () => {
    quiet();
    const sleep = jest.fn().mockResolvedValue(undefined);
    const fn = jest.fn().mockRejectedValueOnce(new Error('ECONNRESET')).mockRejectedValueOnce(new Error('Throttling')).mockResolvedValue('ok');
    await expect(withRetry('ses', fn, { attempts: 3, delayMs: 1000, sleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000]);
  });

  it('hết số lần thì ném lỗi cuối cùng (event vào DLQ), không thử thêm', async () => {
    quiet();
    const sleep = jest.fn().mockResolvedValue(undefined);
    const fn = jest.fn().mockRejectedValue(new Error('down'));
    await expect(withRetry('smtp', fn, { attempts: 3, delayMs: 10, sleep })).rejects.toThrow('down');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('attempts=1 thì không thử lại', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('x'));
    await expect(withRetry('smtp', fn, { attempts: 1, delayMs: 10 })).rejects.toThrow('x');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
