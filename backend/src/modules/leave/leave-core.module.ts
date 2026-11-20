import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { EmployeeModule } from '../employee/employee.module';
import { LeaveBalance } from './leave-balance.entity';
import { LeaveBalanceService } from './leave-balance.service';
import { LeaveCalendar } from './leave-calendar';
import { ApprovalDelegation } from './leave-delegation.entity';
import { Holiday } from './leave-holiday.entity';
import { LeaveJobsService } from './leave-jobs.service';
import { LeaveAllocation, LeaveRequest, LeaveRequestHistory } from './leave-request.entity';
import { LeaveType } from './leave-type.entity';
import { LeaveService } from './leave.service';
import { OutboxEvent } from './outbox/outbox.entity';

/** Phần nghiệp vụ của Leave dùng chung cho API và worker (worker không mở controller, không chạy outbox publisher). */
@Module({
  imports: [
    TypeOrmModule.forFeature([LeaveType, LeaveBalance, LeaveRequest, LeaveRequestHistory, LeaveAllocation, Holiday, ApprovalDelegation, OutboxEvent]),
    EmployeeModule,
    AuditModule,
  ],
  providers: [LeaveService, LeaveBalanceService, LeaveCalendar, LeaveJobsService],
  exports: [LeaveService, LeaveBalanceService, LeaveCalendar, LeaveJobsService],
})
export class LeaveCoreModule {}
