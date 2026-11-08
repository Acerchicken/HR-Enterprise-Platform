import { DynamicModule, Global, Module } from '@nestjs/common';
import { APP_CONFIG, LoadOptions, loadConfig } from './config';

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig() }],
  exports: [APP_CONFIG],
})
export class ConfigModule {
  /** Dùng cho process không phải API (worker): bỏ các kiểm tra chỉ API cần. */
  static register(opts: LoadOptions): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig(process.env, opts) }],
      exports: [APP_CONFIG],
    };
  }
}
