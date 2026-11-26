import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { Department } from './department.entity';
import { DepartmentDeputy } from './department-deputy.entity';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { Position } from './position.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Department, DepartmentDeputy, Position]), AuditModule],
  controllers: [OrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
