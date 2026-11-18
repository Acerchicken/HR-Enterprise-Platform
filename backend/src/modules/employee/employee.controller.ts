import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiOkResponse, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { Request } from 'express';
import { RateLimit } from '../../common/rate-limit/rate-limit.interceptor';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { CurrentUser, Roles } from '../identity/auth.decorators';
import { AuthUser } from '../identity/roles';
import { OrganizationService } from '../organization/organization.service';
import {
  BankAccountSection,
  CreateEmployeeDto,
  DirectoryQuery,
  MembersQuery,
  MeResponse,
  PersonalSection,
  ProfileQuery,
  ProfileSectionQuery,
  ProfileSummary,
  SalarySection,
  UpdateEmployeeDto,
} from './employee.dto';
import { EmployeeService, RequestMeta } from './employee.service';
import { ProfileChangeService } from './profile-change.service';
import { SECTION_SCHEMAS } from './profile-schema';

const COMPUTED = new Set(['career-history', 'milestones', 'long-leaves']);
const meta = (req: Request & { traceId?: string }): RequestMeta => ({ ip: req.ip ?? null, traceId: req.traceId ?? null });

@ApiTags('employee')
@ApiBearerAuth()
@Controller()
export class EmployeeController {
  constructor(
    private readonly employees: EmployeeService,
    private readonly org: OrganizationService,
    private readonly changes: ProfileChangeService,
    private readonly limiter: RateLimitService,
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
  async directory(@Query() q: DirectoryQuery, @CurrentUser() user: AuthUser) {
    // NFR-5.21: tìm kiếm có giới hạn riêng 20 lượt/phút (ô tìm đồng nghiệp gọi API này).
    if (q.q) await this.limiter.consume(user.userId, 'search');
    // AC-2.1.5: lọc theo đơn vị mặc định gồm cả đơn vị con cháu.
    const dept = q.dept && q.includeChildren !== false ? await this.org.descendantIds(q.dept) : q.dept;
    return this.employees.directory({ q: q.q, dept, page: q.page, size: q.size });
  }

  @Post('employees')
  @Roles('HR')
  @RateLimit('profile-write')
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.employees.create(dto, user, meta(req));
  }

  @Get('employees/:id')
  async profile(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: ProfileQuery,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    // AC-1.14.4: xem trường nhạy cảm tối đa 100 lần/giờ, kể cả HR.
    if (q.include === 'sensitive') await this.limiter.consume(user.userId, 'sensitive-view');
    return this.employees.profile(id, user, q.include === 'sensitive', meta(req));
  }

  /** Trang hồ sơ mặc định và thẻ xem nhanh: chỉ gọi API này (AC-1.8.7, AC-0.3.0). */
  @Get('employees/:id/summary')
  @ApiOkResponse({ type: ProfileSummary })
  async summary(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    const s = await this.employees.summary(id, user);
    // Hàng "Diện đối tượng" (mức QL): loại hợp đồng đang hiệu lực (AC-1.12.1).
    if (s.contractType !== undefined) s.contractType = await this.changes.activeContractType(id);
    return s;
  }

  /** Dữ liệu một mục, chỉ khi người dùng bấm vào mục (AC-1.8.8). Không được xem hoặc chưa có thì 404 (AC-1.8.6). */
  @Get('employees/:id/profile/:section')
  @ApiExtraModels(PersonalSection, SalarySection, BankAccountSection)
  @ApiOkResponse({
    schema: { oneOf: [PersonalSection, SalarySection, BankAccountSection].map((m) => ({ $ref: getSchemaPath(m) })) },
  })
  async section(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('section') section: string,
    @Query() q: ProfileSectionQuery,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    if (q.reveal === 'true') await this.limiter.consume(user.userId, 'sensitive-view');
    // Mục tự tính (FR-1.13). `raw=true`: HR quản lý các dòng nhập tay của quá trình công tác.
    if (COMPUTED.has(section) && q.raw !== 'true') return this.changes.computed(id, section, user);
    const schema = SECTION_SCHEMAS[section];
    if (schema && schema.kind !== 'main') return this.changes.readSection(id, section, user, q.reveal === 'true', meta(req));
    const data = await this.employees.section(id, section, user, q.reveal === 'true', meta(req));
    if (data.section !== 'personal') return data;
    // Trường chính nhân viên đề xuất được (điện thoại, địa chỉ) và yêu cầu đang chờ của chủ hồ sơ (AC-1.9.2).
    const own = data.relation === 'OWNER' || data.relation === 'HR';
    return {
      ...data,
      fields: SECTION_SCHEMAS.personal!.fields,
      canPropose: data.relation === 'OWNER',
      requests: own ? await this.changes.openRequests(id, 'personal') : [],
    };
  }

  @Patch('employees/:id')
  @RateLimit('profile-write')
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
  async members(@Param('id', ParseUUIDPipe) id: string, @Query() q: MembersQuery) {
    await this.org.getDepartment(id).catch(() => {
      throw new NotFoundException('Không tìm thấy phòng ban');
    });
    const dept = q.includeChildren ? await this.org.descendantIds(id) : id;
    return this.employees.directory({ dept, page: q.page, size: q.size });
  }
}
