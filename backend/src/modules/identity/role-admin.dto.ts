import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { PageQuery } from '../../common/pagination';

export const ASSIGNABLE_ROLES = ['HR', 'ADMIN'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class RoleAssignmentQuery extends PageQuery {
  @ApiPropertyOptional({ enum: ASSIGNABLE_ROLES })
  @IsOptional()
  @IsIn(ASSIGNABLE_ROLES)
  role?: AssignableRole;

  @ApiPropertyOptional({ description: 'Tìm theo tên hoặc email' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  q?: string;
}

export class GrantRoleDto {
  @ApiProperty()
  @IsUUID()
  employeeId: string;

  @ApiProperty({ enum: ASSIGNABLE_ROLES, description: 'Chỉ HR, ADMIN; EMPLOYEE, MANAGER tự suy ra (ADR-10)' })
  @IsIn(ASSIGNABLE_ROLES, { message: 'role chỉ là HR hoặc ADMIN' })
  role: AssignableRole;

  @ApiProperty({ minLength: 5, maxLength: 200 })
  @Transform(trim)
  @IsString()
  @Length(5, 200, { message: 'Lý do từ 5 đến 200 ký tự' })
  reason: string;
}

export class RevokeRoleDto {
  @ApiProperty({ minLength: 5, maxLength: 200 })
  @Transform(trim)
  @IsString()
  @Length(5, 200, { message: 'Lý do từ 5 đến 200 ký tự' })
  reason: string;
}

export interface RoleAssignmentView {
  userId: string;
  employeeId: string | null;
  fullName: string | null;
  email: string;
  departmentName: string | null;
  role: AssignableRole;
  grantedBy: { id: string; fullName: string | null } | null;
  grantedAt: string;
  reason: string | null;
}
