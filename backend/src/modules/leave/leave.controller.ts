import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RequestMeta } from '../employee/employee.service';
import { CurrentUser, Roles } from '../identity/auth.decorators';
import { AuthUser } from '../identity/roles';
import { LeaveAction } from './leave-state-machine';
import { CreateLeaveRequestDto, HolidayQuery, LeaveDecisionDto, LeaveRequestQuery } from './leave.dto';
import { LeaveService } from './leave.service';

const meta = (req: Request & { traceId?: string }): RequestMeta => ({ ip: req.ip ?? null, traceId: req.traceId ?? null });

@ApiTags('leave')
@ApiBearerAuth()
@Controller()
export class LeaveController {
  constructor(private readonly leave: LeaveService) {}

  @Get('leave-types')
  types() {
    return this.leave.listTypes();
  }

  @Get('leave-holidays')
  holidays(@Query() q: HolidayQuery) {
    return this.leave.listHolidays(q.year);
  }

  @Get('leave-balances/me')
  myBalances(@CurrentUser() user: AuthUser) {
    if (!user.employeeId) throw new NotFoundException('Tài khoản chưa gắn với nhân viên');
    return this.leave.balancesOf(user.employeeId);
  }

  @Post('leave-requests')
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Chuỗi duy nhất cho mỗi lần tạo đơn; gửi lại cùng key trả về đơn đã tạo' })
  create(
    @Body() dto: CreateLeaveRequestDto,
    @Headers('idempotency-key') key: string | undefined,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    if (!key || key.length > 100) throw new BadRequestException('Thiếu header Idempotency-Key (tối đa 100 ký tự)');
    return this.leave.create(dto, key, user, meta(req));
  }

  @Get('leave-requests/me')
  mine(@Query() q: LeaveRequestQuery, @CurrentUser() user: AuthUser) {
    return this.leave.mine(user, q);
  }

  @Get('leave-requests/pending-approval')
  @Roles('MANAGER')
  pendingApproval(@Query() q: LeaveRequestQuery, @CurrentUser() user: AuthUser) {
    return this.leave.pendingApproval(user, q);
  }

  @Get('leave-requests')
  @Roles('HR')
  all(@Query() q: LeaveRequestQuery) {
    return this.leave.all(q);
  }

  @Get('leave-requests/:id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.leave.get(id, user);
  }

  @Post('leave-requests/:id/approve')
  @HttpCode(200)
  @Roles('MANAGER')
  approve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LeaveDecisionDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.act(id, 'approve', dto, user, req);
  }

  @Post('leave-requests/:id/reject')
  @HttpCode(200)
  @Roles('MANAGER')
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LeaveDecisionDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.act(id, 'reject', dto, user, req);
  }

  @Post('leave-requests/:id/cancel')
  @HttpCode(200)
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LeaveDecisionDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.act(id, 'cancel', dto, user, req);
  }

  @Post('leave-requests/:id/complete')
  @HttpCode(200)
  @Roles('HR')
  complete(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LeaveDecisionDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.act(id, 'complete', dto, user, req);
  }

  private act(id: string, action: LeaveAction, dto: LeaveDecisionDto, user: AuthUser, req: Request) {
    return this.leave.act(id, action, dto, user, meta(req));
  }
}
