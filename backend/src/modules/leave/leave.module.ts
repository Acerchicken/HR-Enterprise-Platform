import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { EmployeeModule } from '../employee/employee.module';
import { LeaveBalance } from './leave-balance.entity';
import { Holiday } from './leave-holiday.entity';
import { LeaveRequest, LeaveRequestHistory } from './leave-request.entity';
import { LeaveType } from './leave-type.entity';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import { OutboxPublisher } from './outbox/outbox-publisher';
import { OutboxEvent } from './outbox/outbox.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LeaveType, LeaveBalance, LeaveRequest, LeaveRequestHistory, Holiday, OutboxEvent]), EmployeeModule, AuditModule],
  controllers: [LeaveController],
  providers: [LeaveService, OutboxPublisher],
})
export class LeaveModule {}
