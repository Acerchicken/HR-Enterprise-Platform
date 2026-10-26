import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TraceIdMiddleware } from './common/trace-id.middleware';
import { ConfigModule } from './config/config.module';
import { dataSourceOptions } from './database/data-source';
import { HealthController } from './health.controller';
import { AuditModule } from './modules/audit/audit.module';
import { EmployeeModule } from './modules/employee/employee.module';
import { IdentityModule } from './modules/identity/identity.module';
import { LeaveModule } from './modules/leave/leave.module';
import { OrganizationModule } from './modules/organization/organization.module';

/**
 * Modular monolith (ADR-01): một deployment unit, mỗi module một thư mục + một schema DB.
 * Module chỉ gọi nhau qua service được export, không truy cập repository của module khác.
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRoot({ ...dataSourceOptions, migrationsRun: false }),
    AuditModule,
    OrganizationModule,
    EmployeeModule,
    IdentityModule,
    LeaveModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TraceIdMiddleware).forRoutes('*');
  }
}
