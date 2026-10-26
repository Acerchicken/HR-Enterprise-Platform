import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FieldCrypto } from '../../common/field-crypto';
import { APP_CONFIG, AppConfig } from '../../config/config';
import { AuditModule } from '../audit/audit.module';
import { OrganizationModule } from '../organization/organization.module';
import { EmployeeSensitive } from './employee-sensitive.entity';
import { EmployeeController } from './employee.controller';
import { Employee } from './employee.entity';
import { EmployeeService, FIELD_CRYPTO } from './employee.service';

@Module({
  imports: [TypeOrmModule.forFeature([Employee, EmployeeSensitive]), OrganizationModule, AuditModule],
  controllers: [EmployeeController],
  providers: [
    EmployeeService,
    { provide: FIELD_CRYPTO, inject: [APP_CONFIG], useFactory: (cfg: AppConfig) => new FieldCrypto(cfg.fieldEncryptionKey) },
  ],
  exports: [EmployeeService],
})
export class EmployeeModule {}
