import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator';
import { Request } from 'express';
import { PageQuery } from '../../common/pagination';
import { RateLimit } from '../../common/rate-limit/rate-limit.interceptor';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { CurrentUser, Roles } from '../identity/auth.decorators';
import { AuthUser } from '../identity/roles';
import { RequestMeta } from './employee.service';
import { ProfileChangeService } from './profile-change.service';

const meta = (req: Request & { traceId?: string }): RequestMeta => ({ ip: req.ip ?? null, traceId: req.traceId ?? null });
const SECTION = /^[a-z-]{2,40}$/;

export class SubmitChangeDto {
  @ApiProperty({ example: 'emergency-contacts' })
  @Matches(SECTION)
  section: string;

  @ApiProperty({ enum: ['CREATE', 'UPDATE', 'DELETE'] })
  @IsIn(['CREATE', 'UPDATE', 'DELETE'])
  action: 'CREATE' | 'UPDATE' | 'DELETE';

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  itemId?: string | null;

  @ApiPropertyOptional({ description: 'version của dòng lúc mở form (sửa, xóa)' })
  @IsOptional()
  @IsInt()
  baseVersion?: number;

  @ApiPropertyOptional({ description: 'Giá trị đề xuất theo mô tả trường của mục (fields trong GET mục)' })
  @IsOptional()
  @IsObject()
  proposed?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String], description: 'File đã tải lên gắn vào yêu cầu (luồng 4.3)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  fileIds?: string[];
}

export class RejectDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @Length(1, 500, { message: 'Lý do từ chối từ 1 đến 500 ký tự' })
  reason: string;
}

export class ChangeListQuery extends PageQuery {
  @ApiPropertyOptional({ enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] })
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(SECTION)
  section?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class RevealQuery {
  @ApiPropertyOptional({ description: 'true: HR xem giá trị nhạy cảm của đề xuất (ghi audit VIEW_SENSITIVE)' })
  @IsOptional()
  @IsIn(['true', 'false'])
  reveal?: 'true' | 'false';
}

export class HrItemDto {
  @ApiPropertyOptional({ description: 'version của dòng (bắt buộc khi sửa, xóa)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  version?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

export class ExpiringQuery {
  @ApiPropertyOptional({ default: 30, minimum: 1, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}

export class HistoryQuery extends PageQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(SECTION)
  section?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-01' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

/** Yêu cầu cập nhật hồ sơ (UC1 FR-1.9), HR sửa trực tiếp mục (A9), nhật ký thay đổi (FR-1.11). */
@ApiTags('employee')
@ApiBearerAuth()
@Controller()
export class ProfileChangeController {
  constructor(
    private readonly changes: ProfileChangeService,
    private readonly limiter: RateLimitService,
  ) {}

  @Post('employees/:id/change-requests')
  @RateLimit('profile-write')
  @HttpCode(202)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitChangeDto,
    @Headers('idempotency-key') key: string | undefined,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.changes.submit(id, dto, user, key, meta(req));
  }

  @Delete('employees/:id/change-requests/:requestId')
  @RateLimit('profile-write')
  @HttpCode(204)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    await this.changes.cancel(id, requestId, user, meta(req));
  }

  /** Nhân viên đóng thông báo bị từ chối. */
  @Post('employees/:id/change-requests/:requestId/acknowledge')
  @HttpCode(204)
  async acknowledge(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.changes.acknowledge(id, requestId, user);
  }

  @Get('change-requests')
  @Roles('HR')
  list(@Query() q: ChangeListQuery) {
    return this.changes.list(q);
  }

  @Get('change-requests/:requestId')
  async detail(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Query() q: RevealQuery,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    if (q.reveal === 'true') await this.limiter.consume(user.userId, 'sensitive-view');
    return this.changes.detail(requestId, user, q.reveal === 'true', meta(req));
  }

  @Post('change-requests/:requestId/approve')
  @RateLimit('profile-write')
  @Roles('HR')
  @HttpCode(200)
  approve(@Param('requestId', ParseUUIDPipe) requestId: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.changes.approve(requestId, user, meta(req));
  }

  @Post('change-requests/:requestId/reject')
  @RateLimit('profile-write')
  @Roles('HR')
  @HttpCode(200)
  reject(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: RejectDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.changes.reject(requestId, dto.reason, user, meta(req));
  }

  // ----- HR sửa trực tiếp các dòng của mục (ghi thẳng, không qua yêu cầu) -----

  @Post('employees/:id/profile/:section')
  @RateLimit('profile-write')
  @Roles('HR')
  @HttpCode(204)
  async hrCreate(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('section') section: string,
    @Body() dto: HrItemDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    await this.changes.hrWrite(id, section, 'CREATE', null, dto, user, meta(req));
  }

  /** `itemId` là `main` với mục một dòng (tài khoản ngân hàng). */
  @Patch('employees/:id/profile/:section/:itemId')
  @RateLimit('profile-write')
  @Roles('HR')
  @HttpCode(204)
  async hrUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('section') section: string,
    @Param('itemId') itemId: string,
    @Body() dto: HrItemDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    await this.changes.hrWrite(id, section, 'UPDATE', itemId === 'main' ? null : itemId, dto, user, meta(req));
  }

  @Delete('employees/:id/profile/:section/:itemId')
  @RateLimit('profile-write')
  @Roles('HR')
  @HttpCode(204)
  async hrDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('section') section: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Query() q: HrItemDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    await this.changes.hrWrite(id, section, 'DELETE', itemId, { version: q.version }, user, meta(req));
  }

  /** AC-1.12.5: hợp đồng sắp hết hạn trong `days` ngày tới (mặc định 30). */
  @Get('contracts/expiring')
  @Roles('HR')
  expiring(@Query() q: ExpiringQuery) {
    return this.changes.expiringContracts(q.days ?? 30);
  }

  @Get('employees/:id/history')
  history(@Param('id', ParseUUIDPipe) id: string, @Query() q: HistoryQuery, @CurrentUser() user: AuthUser) {
    return this.changes.history(id, user, {
      section: q.section,
      actorId: q.actorId,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      page: q.page,
      size: q.size,
    });
  }
}
