import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, IsUUID } from 'class-validator';
import { PageQuery } from '../../common/pagination';
import { Roles } from '../identity/auth.decorators';
import { AuditService } from './audit.service';

class AuditLogQuery extends PageQuery {
  @ApiPropertyOptional({ example: 'employee' })
  @IsOptional()
  @IsString()
  entity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  actor?: string;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Roles('HR', 'ADMIN')
  search(@Query() q: AuditLogQuery) {
    return this.audit.search({
      entityType: q.entity,
      entityId: q.entityId,
      actorId: q.actor,
      from: q.from,
      to: q.to,
      page: q.page,
      size: q.size,
    });
  }
}
