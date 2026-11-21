import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '../config/config.module';
import { dataSourceOptions } from '../database/data-source';
import { EmployeeModule } from '../modules/employee/employee.module';
import { LeaveCoreModule } from '../modules/leave/leave-core.module';
import { APP_CONFIG, AppConfig } from '../config/config';
import { createIdpAdmin } from '../modules/identity/idp-admin/factory';
import { IDP_ADMIN } from '../modules/identity/idp-admin/idp-admin';
import { IdentitySync } from './identity-sync';
import { LeaveJob } from './leave-job';
import { NotificationWorker } from './notification-worker';
import { TransferJob } from './transfer-job';

/** Process riêng của worker: không mở HTTP, chỉ cần DB (tra email qua EmployeeService), RabbitMQ và IdP (identity-sync). */
@Module({
  imports: [ConfigModule.register({ needsAuth: false }), TypeOrmModule.forRoot({ ...dataSourceOptions, migrationsRun: false }), EmployeeModule, LeaveCoreModule],
  providers: [
    NotificationWorker,
    TransferJob,
    LeaveJob,
    IdentitySync,
    { provide: IDP_ADMIN, inject: [APP_CONFIG], useFactory: (cfg: AppConfig) => createIdpAdmin(cfg) },
  ],
})
export class WorkerModule {}
