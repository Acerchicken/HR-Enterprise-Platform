import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FieldCrypto } from '../../common/field-crypto';
import { APP_CONFIG, AppConfig } from '../../config/config';
import { AuditModule } from '../audit/audit.module';
import { OrganizationModule } from '../organization/organization.module';
import { EmployeeSensitive } from './employee-sensitive.entity';
import { EmployeeController } from './employee.controller';
import { Employee } from './employee.entity';
import { ProfileChangeController } from './profile-change.controller';
import { ProfileChangeRequest, ProfileItem } from './profile-change.entity';
import { ProfileChangeService } from './profile-change.service';
import { EmployeeService, FIELD_CRYPTO } from './employee.service';

@Module({
  imports: [TypeOrmModule.forFeature([Employee, EmployeeSensitive, ProfileItem, ProfileChangeRequest]), OrganizationModule, AuditModule],
  controllers: [EmployeeController, ProfileChangeController],
  providers: [
    EmployeeService,
    ProfileChangeService,
    { provide: FIELD_CRYPTO, inject: [APP_CONFIG], useFactory: (cfg: AppConfig) => new FieldCrypto(cfg.fieldEncryptionKey) },
  ],
  exports: [EmployeeService],
})
export class EmployeeModule {}
