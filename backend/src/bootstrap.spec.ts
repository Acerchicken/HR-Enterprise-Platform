import { Controller, Get, Req } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Request } from 'express';
import request from 'supertest';
import { configureApp } from './bootstrap';
import { loadConfig } from './config/config';

@Controller('ip')
class IpController {
  @Get()
  ip(@Req() req: Request) {
    return { ip: req.ip };
  }
}

/** staging-readiness F5: sau proxy, req.ip (ghi vào audit, dùng cho rate limit) phải là IP người dùng. */
describe('configureApp: TRUST_PROXY', () => {
  const ipFor = async (trustProxy: string | undefined) => {
    const mod = await Test.createTestingModule({ controllers: [IpController] }).compile();
    const app = mod.createNestApplication();
    configureApp(app, loadConfig(trustProxy === undefined ? {} : { TRUST_PROXY: trustProxy }));
    await app.init();
    const res = await request(app.getHttpServer()).get('/api/v1/ip').set('X-Forwarded-For', '203.0.113.9, 198.51.100.7');
    await app.close();
    return res.body.ip as string;
  };

  it('mặc định không tin X-Forwarded-For (người dùng không giả được IP)', async () => {
    expect(await ipFor(undefined)).not.toBe('198.51.100.7');
    expect(await ipFor(undefined)).not.toBe('203.0.113.9');
  });

  it('TRUST_PROXY=1 lấy địa chỉ do proxy gần nhất thêm vào', async () => {
    expect(await ipFor('1')).toBe('198.51.100.7');
  });
});
