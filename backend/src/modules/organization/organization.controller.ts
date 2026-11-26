import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../identity/auth.decorators';
import { AuthUser } from '../identity/roles';
import { CreateDepartmentDto, CreatePositionDto, PositionQuery, UpdateDepartmentDto, UpdatePositionDto } from './organization.dto';
import { OrganizationService } from './organization.service';

@ApiTags('organization')
@ApiBearerAuth()
@Controller()
export class OrganizationController {
  constructor(private readonly org: OrganizationService) {}

  @Get('departments')
  list(@CurrentUser() user: AuthUser) {
    return this.org.listFor(user);
  }

  @Get('departments/tree')
  tree() {
    return this.org.tree();
  }

  @Get('departments/:id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.org.detail(id, user);
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
  positions(@Query() q: PositionQuery) {
    return this.org.positionViews(q.active === true);
  }

  // AC-2.6.1: chỉ HR quản lý danh mục chức danh.
  @Post('positions')
  @Roles('HR')
  createPosition(@Body() dto: CreatePositionDto, @CurrentUser() user: AuthUser) {
    return this.org.createPosition(dto, user);
  }

  @Patch('positions/:id')
  @Roles('HR')
  updatePosition(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePositionDto, @CurrentUser() user: AuthUser) {
    return this.org.updatePosition(id, dto, user);
  }
}
