import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { APP_CONFIG, AppConfig } from './config/config';
import { Public } from './modules/identity/auth.decorators';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly ds: DataSource,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
  ) {}

  /**
   * Load balancer gọi endpoint này để biết instance còn sống và kết nối được DB. `version`: commit hoặc tag đang chạy
   * (NFR-8.5), để kiểm tra sau deploy hoặc rollback.
   */
  @Public()
  @Get()
  async check() {
    await this.ds.query('SELECT 1');
    return { status: 'ok', version: this.cfg.appVersion };
  }
}
