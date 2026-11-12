import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { EmployeeModule } from '../employee/employee.module';
import { OrganizationModule } from '../organization/organization.module';
import { DocumentController } from './document.controller';
import { DocumentEntity, DocumentScope, DocumentVersion } from './document.entity';
import { DocumentService } from './document.service';
import { ObjectStorage } from './object-storage';

/** Kho tài liệu HR (UC5). Schema riêng `document`; gọi Employee/Organization qua service đã export (ADR-01). */
@Module({
  imports: [TypeOrmModule.forFeature([DocumentEntity, DocumentScope, DocumentVersion]), EmployeeModule, OrganizationModule, AuditModule],
  controllers: [DocumentController],
  providers: [DocumentService, ObjectStorage],
  exports: [DocumentService],
})
export class DocumentModule {}
