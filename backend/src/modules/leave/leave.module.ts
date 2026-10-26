import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveBalance } from './leave-balance.entity';
import { LeaveRequest, LeaveRequestHistory } from './leave-request.entity';
import { LeaveType } from './leave-type.entity';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';

@Module({
  imports: [TypeOrmModule.forFeature([LeaveType, LeaveBalance, LeaveRequest, LeaveRequestHistory])],
  controllers: [LeaveController],
  providers: [LeaveService],
})
export class LeaveModule {}
