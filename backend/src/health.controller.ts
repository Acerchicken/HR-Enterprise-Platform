import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { Public } from './modules/identity/auth.decorators';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly ds: DataSource) {}

  /** Load balancer gọi endpoint này để biết instance còn sống và kết nối được DB. */
  @Public()
  @Get()
  async check() {
    await this.ds.query('SELECT 1');
    return { status: 'ok' };
  }
}
