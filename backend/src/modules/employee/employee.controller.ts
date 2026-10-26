import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PageQuery } from '../../common/pagination';
import { CurrentUser, Roles } from '../identity/auth.decorators';
import { AuthUser } from '../identity/roles';
import { OrganizationService } from '../organization/organization.service';
import { CreateEmployeeDto, DirectoryQuery, ProfileQuery, UpdateEmployeeDto } from './employee.dto';
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

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    if (!user.employeeId) {
      return { email: user.email, roles: user.roles, employee: null };
    }
    return {
      email: user.email,
      roles: user.roles,
      employee: await this.employees.profile(user.employeeId, user, false),
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
