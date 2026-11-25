import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '../config/config.module';
import { runtimeDataSourceOptions } from '../database/data-source';
import { EmployeeModule } from '../modules/employee/employee.module';
import { LeaveCoreModule } from '../modules/leave/leave-core.module';
import { APP_CONFIG, AppConfig } from '../config/config';
import { RateLimitModule } from '../common/rate-limit/rate-limit.interceptor';
import { createIdpAdmin } from '../modules/identity/idp-admin/factory';
import { IDP_ADMIN } from '../modules/identity/idp-admin/idp-admin';
import { IdentitySync } from './identity-sync';
import { LeaveJob } from './leave-job';
import { IdentityWorker } from './identity-worker';
import { TransferJob } from './transfer-job';

/**
 * Process riêng của worker: không mở HTTP, chỉ cần DB, queue event tài khoản và IdP (identity-sync), cùng các job nền.
 * Email do `services/notification` gửi (ADR-15 bước 1).
 * RateLimitModule: EmployeeModule cần RateLimitService (ProfileFileService); interceptor không có tác dụng vì worker không nhận request.
 */
@Module({
  imports: [ConfigModule.register({ needsAuth: false }), TypeOrmModule.forRoot({ ...runtimeDataSourceOptions, migrationsRun: false }), RateLimitModule, EmployeeModule, LeaveCoreModule],
  providers: [
    IdentityWorker,
    TransferJob,
    LeaveJob,
    IdentitySync,
    { provide: IDP_ADMIN, inject: [APP_CONFIG], useFactory: (cfg: AppConfig) => createIdpAdmin(cfg) },
  ],
})
export class WorkerModule {}
