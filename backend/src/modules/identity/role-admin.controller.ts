import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from './auth.decorators';
import { GrantRoleDto, RevokeRoleDto, RoleAssignmentQuery } from './role-admin.dto';
import { RoleAdminService } from './role-admin.service';
import { AuthUser } from './roles';

/** UC8 FR-8.7 (spec 9.2 "Vai trò"). Chỉ ADMIN, kể cả HR bị 403 (AC-8.7.5). */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/role-assignments')
@Roles('ADMIN')
export class RoleAdminController {
  constructor(private readonly roles: RoleAdminService) {}

  @Get()
  list(@Query() q: RoleAssignmentQuery) {
    return this.roles.list(q);
  }

  @Post()
  grant(@Body() dto: GrantRoleDto, @CurrentUser() user: AuthUser) {
    return this.roles.grant(user, dto);
  }

  @Delete(':userId/:role')
  @HttpCode(204)
  async revoke(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('role') role: string,
    @Body() dto: RevokeRoleDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.roles.revoke(user, userId, role, dto.reason);
  }
}
