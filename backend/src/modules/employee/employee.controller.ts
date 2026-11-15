import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiOkResponse, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { Request } from 'express';
import { PageQuery } from '../../common/pagination';
import { CurrentUser, Roles } from '../identity/auth.decorators';
import { AuthUser } from '../identity/roles';
import { OrganizationService } from '../organization/organization.service';
import {
  BankAccountSection,
  CreateEmployeeDto,
  DirectoryQuery,
  MeResponse,
  PersonalSection,
  ProfileQuery,
  ProfileSectionQuery,
  ProfileSummary,
  SalarySection,
  UpdateEmployeeDto,
} from './employee.dto';
import { EmployeeService, RequestMeta } from './employee.service';

const meta = (req: Request & { traceId?: string }): RequestMeta => ({ ip: req.ip ?? null, traceId: req.traceId ?? null });

@ApiTags('employee')
@ApiBearerAuth()
@Controller()
export class EmployeeController {
  constructor(
    private readonly employees: EmployeeService,
    private readonly org: OrganizationService,
  ) {}

  /** Chỉ tài khoản, vai trò và mã, tên hồ sơ; dữ liệu hồ sơ lấy qua `summary` khi mở popup (AC-1.8.7). */
  @Get('me')
  @ApiOkResponse({ type: MeResponse })
  async me(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    return {
      email: user.email,
      roles: user.roles,
      employee: user.employeeId ? await this.employees.meEmployee(user.employeeId) : null,
    };
  }

  @Get('employees')
  directory(@Query() q: DirectoryQuery) {
    return this.employees.directory(q);
  }

  @Post('employees')
  @Roles('HR')
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.employees.create(dto, user, meta(req));
  }

  @Get('employees/:id')
  profile(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: ProfileQuery,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.employees.profile(id, user, q.include === 'sensitive', meta(req));
  }

  /** Trang hồ sơ mặc định và thẻ xem nhanh: chỉ gọi API này (AC-1.8.7, AC-0.3.0). */
  @Get('employees/:id/summary')
  @ApiOkResponse({ type: ProfileSummary })
  summary(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.employees.summary(id, user);
  }

  /** Dữ liệu một mục, chỉ khi người dùng bấm vào mục (AC-1.8.8). Không được xem hoặc chưa có thì 404 (AC-1.8.6). */
  @Get('employees/:id/profile/:section')
  @ApiExtraModels(PersonalSection, SalarySection, BankAccountSection)
  @ApiOkResponse({
    schema: { oneOf: [PersonalSection, SalarySection, BankAccountSection].map((m) => ({ $ref: getSchemaPath(m) })) },
  })
  section(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('section') section: string,
    @Query() q: ProfileSectionQuery,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.employees.section(id, section, user, q.reveal === 'true', meta(req));
  }

  @Patch('employees/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.employees.update(id, dto, user, meta(req));
  }

  @Get('employees/:id/direct-reports')
  directReports(@Param('id', ParseUUIDPipe) id: string) {
    return this.employees.directReports(id);
  }

  @Get('departments/:id/members')
  async members(@Param('id', ParseUUIDPipe) id: string, @Query() q: PageQuery) {
    await this.org.getDepartment(id).catch(() => {
      throw new NotFoundException('Không tìm thấy phòng ban');
    });
    return this.employees.directory({ dept: id, page: q.page, size: q.size });
  }
}
