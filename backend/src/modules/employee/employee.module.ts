import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FieldCrypto } from '../../common/field-crypto';
import { APP_CONFIG, AppConfig } from '../../config/config';
import { AuditModule } from '../audit/audit.module';
import { OrganizationModule } from '../organization/organization.module';
import { EmployeeSensitive } from './employee-sensitive.entity';
import { EmployeeController } from './employee.controller';
import { EmploymentAssignment } from './employment-assignment.entity';
import { TransferService } from './transfer.service';
import { Employee } from './employee.entity';
import { ProfileChangeController } from './profile-change.controller';
import { ProfileChangeRequest, ProfileFile, ProfileItem } from './profile-change.entity';
import { ProfileFileController } from './profile-file.controller';
import { ProfileFileService, ProfileStorage } from './profile-file.service';
import { ProfileChangeService } from './profile-change.service';
import { EmployeeService, FIELD_CRYPTO } from './employee.service';

@Module({
  imports: [TypeOrmModule.forFeature([Employee, EmployeeSensitive, EmploymentAssignment, ProfileItem, ProfileChangeRequest, ProfileFile]), OrganizationModule, AuditModule],
  controllers: [EmployeeController, ProfileChangeController, ProfileFileController],
  providers: [
    EmployeeService,
    ProfileChangeService,
    ProfileFileService,
    ProfileStorage,
    TransferService,
    { provide: FIELD_CRYPTO, inject: [APP_CONFIG], useFactory: (cfg: AppConfig) => new FieldCrypto(cfg.fieldEncryptionKey) },
  ],
  exports: [EmployeeService, TransferService],
})
export class EmployeeModule {}
