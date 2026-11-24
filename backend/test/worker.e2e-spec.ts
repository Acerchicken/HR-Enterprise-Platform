/**
 * Worker khởi động được (DI đầy đủ): bắt lỗi thiếu provider như RateLimitService trong EmployeeModule
 * mà bộ e2e của API không thấy vì AppModule đã import RateLimitModule.
 */
process.env.AUTH_MODE = 'dev';

import { Test } from '@nestjs/testing';
import { NotificationWorker } from '../src/worker/notification-worker';
import { WorkerModule } from '../src/worker/worker.module';

describe('Worker (e2e)', () => {
  it('dựng được toàn bộ WorkerModule', async () => {
    const mod = await Test.createTestingModule({ imports: [WorkerModule] }).compile();
    const ctx = await mod.init();
    expect(ctx.get(NotificationWorker)).toBeDefined();
    await ctx.close();
  });
});
