import { Controller, Get, NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../identity/auth.decorators';
import { AuthUser } from '../identity/roles';
import { LeaveService } from './leave.service';

@ApiTags('leave')
@ApiBearerAuth()
@Controller()
export class LeaveController {
  constructor(private readonly leave: LeaveService) {}

  @Get('leave-types')
  types() {
    return this.leave.listTypes();
  }

  @Get('leave-balances/me')
  myBalances(@CurrentUser() user: AuthUser) {
    if (!user.employeeId) throw new NotFoundException('Tài khoản chưa gắn với nhân viên');
    return this.leave.balancesOf(user.employeeId);
  }
}
