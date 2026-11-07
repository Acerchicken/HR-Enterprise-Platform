import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '../config/config.module';
import { dataSourceOptions } from '../database/data-source';
import { EmployeeModule } from '../modules/employee/employee.module';
import { NotificationWorker } from './notification-worker';

/** Process riêng của worker: không mở HTTP, chỉ cần DB (tra email qua EmployeeService) và RabbitMQ. */
@Module({
  imports: [ConfigModule.register({ needsAuth: false }), TypeOrmModule.forRoot({ ...dataSourceOptions, migrationsRun: false }), EmployeeModule],
  providers: [NotificationWorker],
})
export class WorkerModule {}
