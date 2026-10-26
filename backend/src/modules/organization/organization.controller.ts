import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../identity/auth.decorators';
import { AuthUser } from '../identity/roles';
import { CreateDepartmentDto, UpdateDepartmentDto } from './organization.dto';
import { OrganizationService } from './organization.service';

@ApiTags('organization')
@ApiBearerAuth()
@Controller()
export class OrganizationController {
  constructor(private readonly org: OrganizationService) {}

  @Get('departments')
  list() {
    return this.org.listDepartments();
  }

  @Get('departments/tree')
  tree() {
    return this.org.tree();
  }

  @Get('departments/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.org.getDepartment(id);
  }

  @Post('departments')
  @Roles('HR', 'ADMIN')
  create(@Body() dto: CreateDepartmentDto, @CurrentUser() user: AuthUser) {
    return this.org.create(dto, user);
  }

  @Patch('departments/:id')
  @Roles('HR', 'ADMIN')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDepartmentDto, @CurrentUser() user: AuthUser) {
    return this.org.update(id, dto, user);
  }

  @Get('positions')
  positions() {
    return this.org.listPositions();
  }
}
