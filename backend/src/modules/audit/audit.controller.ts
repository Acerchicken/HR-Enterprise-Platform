import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PageQuery } from '../../common/pagination';
import { CurrentUser, Roles } from '../identity/auth.decorators';
import { AuthUser, hasRole } from '../identity/roles';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, HR_ONLY_ENTITY_TYPES } from './audit-catalog';
import { auditPeriod, isAuditDate } from './audit-period';
import { AuditService } from './audit.service';

const toArray = ({ value }: { value: unknown }) =>
  value === undefined || value === '' ? undefined : (Array.isArray(value) ? value : String(value).split(',')).map((v) => String(v).trim());

class AuditLogQuery extends PageQuery {
  @ApiPropertyOptional({ enum: AUDIT_ENTITY_TYPES, example: 'employee' })
  @IsOptional()
  @IsIn(AUDIT_ENTITY_TYPES)
  entity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityId?: string;

  @ApiPropertyOptional({ description: 'UUID hồ sơ nhân viên của người thực hiện' })
  @IsOptional()
  @IsUUID()
  actor?: string;

  @ApiPropertyOptional({
    description: 'Một hoặc nhiều hành động (lặp tham số hoặc ngăn bằng dấu phẩy), UC7 D3',
    type: [String],
    enum: AUDIT_ACTIONS,
  })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @ArrayMaxSize(AUDIT_ACTIONS.length)
  @IsIn(AUDIT_ACTIONS, { each: true })
  action?: string[];

  @ApiPropertyOptional({ description: 'YYYY-MM-DD (00:00 giờ Việt Nam) hoặc ngày giờ ISO 8601; tính cả mốc', example: '2026-11-01' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD (tính cả ngày, giờ Việt Nam) hoặc ngày giờ ISO 8601; tính cả mốc', example: '2026-11-01' })
  @IsOptional()
  @IsString()
  to?: string;
}

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /**
   * UC7 FR-7.3. Mới nhất trước. Người chỉ có `ADMIN` không thấy audit đơn nghỉ, số dư phép (D1): lọc ở SQL, kể cả khi họ chọn
   * đúng loại đối tượng đó (trả rỗng).
   */
  @Get()
  @Roles('HR', 'ADMIN')
  search(@Query() q: AuditLogQuery, @CurrentUser() user: AuthUser) {
    const fields: Record<string, string> = {};
    if (q.from && !isAuditDate(q.from)) fields.from = 'Ngày phải theo dạng YYYY-MM-DD hoặc ISO 8601';
    if (q.to && !isAuditDate(q.to)) fields.to = 'Ngày phải theo dạng YYYY-MM-DD hoặc ISO 8601';
    if (Object.keys(fields).length) throw new BadRequestException({ message: 'Ngày không hợp lệ', fields });
    const { from, toExclusive } = auditPeriod(q.from, q.to);
    if (from && toExclusive && from >= toExclusive) {
      throw new BadRequestException({ message: '"Từ ngày" phải trước "Đến ngày"', fields: { to: 'Phải sau "Từ ngày"' } });
    }
    return this.audit.search({
      entityType: q.entity,
      entityId: q.entityId,
      actorId: q.actor,
      actions: q.action,
      excludeEntityTypes: hasRole(user, 'HR') ? [] : HR_ONLY_ENTITY_TYPES,
      from,
      toExclusive,
      page: q.page,
      size: q.size,
    });
  }
}
