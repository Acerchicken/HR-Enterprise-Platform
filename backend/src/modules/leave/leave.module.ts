import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EmployeeModule } from '../employee/employee.module';
import { LeaveAdminService } from './leave-admin.service';
import { LeaveCoreModule } from './leave-core.module';
import { LeaveController } from './leave.controller';
import { OutboxPublisher } from './outbox/outbox-publisher';

@Module({
  imports: [LeaveCoreModule, EmployeeModule, AuditModule],
  controllers: [LeaveController],
  providers: [LeaveAdminService, OutboxPublisher],
})
export class LeaveModule {}
