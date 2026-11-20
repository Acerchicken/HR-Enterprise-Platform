import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { EmployeeService, RequestMeta } from '../employee/employee.service';
import { CurrentUser, Roles } from '../identity/auth.decorators';
import { AuthUser, hasRole } from '../identity/roles';
import { LeaveAdminService } from './leave-admin.service';
import { LeaveBalanceService } from './leave-balance.service';
import { isValidDate } from './leave-rules';
import { LeaveAction } from './leave-state-machine';
import {
  AdjustBalanceDto,
  BalanceQuery,
  CancelRequestDto,
  CreateDelegationDto,
  CreateHolidayDto,
  CreateLeaveRequestDto,
  DelegationQuery,
  LeaveDecisionDto,
  LeaveRequestQuery,
  RecalculateDto,
  YearQuery,
} from './leave.dto';
import { LeaveService } from './leave.service';

const meta = (req: Request & { traceId?: string }): RequestMeta => ({ ip: req.ip ?? null, traceId: req.traceId ?? null });

/** UC3, UC4: hợp đồng API ở UC3 spec 9.3 và UC4 spec 9.3. */
@ApiTags('leave')
@ApiBearerAuth()
@Controller()
export class LeaveController {
  constructor(
    private readonly leave: LeaveService,
    private readonly balances: LeaveBalanceService,
    private readonly admin: LeaveAdminService,
    private readonly employees: EmployeeService,
  ) {}

  @Get('leave-types')
  types() {
    return this.leave.listTypes();
  }

  // ---------- Lịch lễ (BR-03, FR-4.9) ----------

  @Get('leave-holidays')
  holidays(@Query() q: YearQuery) {
    return this.admin.listHolidays(q.year ?? this.balances.thisYear());
  }

  @Post('leave-holidays')
  @Roles('HR')
  addHoliday(@Body() dto: CreateHolidayDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.admin.addHoliday(dto, user, meta(req));
  }

  @Delete('leave-holidays/:date')
  @Roles('HR')
  deleteHoliday(@Param('date') date: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    if (!isValidDate(date)) throw new BadRequestException('Ngày không hợp lệ');
    return this.admin.deleteHoliday(date, user, meta(req));
  }

  // ---------- Số dư (FR-3.1, FR-3.8) ----------

  @Get('leave-balances/me')
  myBalances(@Query() q: YearQuery, @CurrentUser() user: AuthUser) {
    if (!user.employeeId) throw new ForbiddenException('Tài khoản chưa gắn với hồ sơ nhân viên');
    return this.balances.view(user.employeeId, q.year ?? this.balances.thisYear(), false);
  }

  /** HR xem mọi người; quản lý trực tiếp chỉ cấp dưới trực tiếp, không thấy mức nền, ghi chú (AC-3.8.4). */
  @Get('leave-balances')
  async balancesOf(@Query() q: BalanceQuery, @CurrentUser() user: AuthUser) {
    const isHr = hasRole(user, 'HR');
    if (!isHr && (!user.employeeId || (await this.employees.managerIdOf(q.employeeId)) !== user.employeeId)) {
      throw new ForbiddenException('Chỉ HR hoặc quản lý trực tiếp xem số dư của nhân viên');
    }
    return this.balances.view(q.employeeId, q.year ?? this.balances.thisYear(), isHr);
  }

  @Put('leave-balances/:employeeId/:leaveType/:year')
  @Roles('HR')
  adjust(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('leaveType') leaveType: string,
    @Param('year') year: string,
    @Body() dto: AdjustBalanceDto,
    @CurrentUser() user: AuthUser,
  ) {
    const y = Number(year);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) throw new BadRequestException('Năm không hợp lệ');
    return this.balances.adjust(employeeId, leaveType, y, dto, user.employeeId);
  }

  // ---------- Đơn (UC3) ----------

  @Post('leave-requests')
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Chuỗi duy nhất cho mỗi lần tạo đơn; gửi lại cùng key trả về đơn đã tạo' })
  create(@Body() dto: CreateLeaveRequestDto, @Headers('idempotency-key') key: string | undefined, @CurrentUser() user: AuthUser, @Req() req: Request) {
    if (!key || key.length > 100) throw new BadRequestException('Thiếu header Idempotency-Key (tối đa 100 ký tự)');
    return this.leave.create(dto, key, user, meta(req));
  }

  @Get('leave-requests/me')
  mine(@Query() q: LeaveRequestQuery, @CurrentUser() user: AuthUser) {
    return this.leave.mine(user, q);
  }

  @Get('leave-requests/pending-approval')
  @Roles('MANAGER', 'HR')
  pendingApproval(@Query() q: LeaveRequestQuery, @CurrentUser() user: AuthUser) {
    return this.leave.pendingApproval(user, q);
  }

  @Get('leave-requests/pending-hr')
  @Roles('HR')
  pendingHr(@Query() q: LeaveRequestQuery, @CurrentUser() user: AuthUser) {
    return this.leave.pendingHr(user, q);
  }

  @Get('leave-requests/affected-by-holidays')
  @Roles('HR')
  affected(@Query() q: YearQuery) {
    return this.leave.affectedByHolidays(q.year ?? this.balances.thisYear());
  }

  @Get('leave-requests')
  @Roles('HR')
  all(@Query() q: LeaveRequestQuery, @CurrentUser() user: AuthUser) {
    return this.leave.all(q, user);
  }

  @Get('leave-requests/:id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.leave.get(id, user);
  }

  @Post('leave-requests/:id/approve')
  @HttpCode(200)
  approve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LeaveDecisionDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.act(id, 'approve', dto, user, req);
  }

  @Post('leave-requests/:id/reject')
  @HttpCode(200)
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LeaveDecisionDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.act(id, 'reject', dto, user, req);
  }

  @Post('leave-requests/:id/hr-approve')
  @HttpCode(200)
  @Roles('HR')
  hrApprove(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LeaveDecisionDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.act(id, 'hrApprove', dto, user, req);
  }

  @Post('leave-requests/:id/hr-reject')
  @HttpCode(200)
  @Roles('HR')
  hrReject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LeaveDecisionDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.act(id, 'hrReject', dto, user, req);
  }

  @Post('leave-requests/:id/cancel')
  @HttpCode(200)
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LeaveDecisionDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.act(id, 'cancel', dto, user, req);
  }

  @Post('leave-requests/:id/cancel-request')
  @HttpCode(200)
  cancelRequest(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelRequestDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.leave.act(id, 'cancelRequest', dto, user, meta(req));
  }

  @Post('leave-requests/:id/cancel-request/approve')
  @HttpCode(200)
  cancelRequestApprove(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LeaveDecisionDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.act(id, 'cancelRequestApprove', dto, user, req);
  }

  @Post('leave-requests/:id/cancel-request/reject')
  @HttpCode(200)
  cancelRequestReject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LeaveDecisionDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.act(id, 'cancelRequestReject', dto, user, req);
  }

  @Post('leave-requests/:id/complete')
  @HttpCode(200)
  @Roles('HR')
  complete(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LeaveDecisionDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.act(id, 'complete', dto, user, req);
  }

  @Post('leave-requests/:id/recalculate')
  @HttpCode(200)
  @Roles('HR')
  recalculate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RecalculateDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.leave.recalculate(id, dto, user, meta(req));
  }

  // ---------- Người duyệt thay (FR-4.3) ----------

  @Get('leave-delegations')
  @Roles('HR')
  delegations(@Query() q: DelegationQuery) {
    return this.admin.listDelegations(q);
  }

  @Post('leave-delegations')
  @Roles('HR')
  createDelegation(@Body() dto: CreateDelegationDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.admin.createDelegation(dto, user, meta(req));
  }

  @Post('leave-delegations/:id/end')
  @HttpCode(200)
  @Roles('HR')
  endDelegation(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.admin.endDelegation(id, user, meta(req));
  }

  private act(id: string, action: Exclude<LeaveAction, 'systemCancel' | 'cancelRequest'>, dto: LeaveDecisionDto, user: AuthUser, req: Request) {
    return this.leave.act(id, action, dto, user, meta(req));
  }
}
