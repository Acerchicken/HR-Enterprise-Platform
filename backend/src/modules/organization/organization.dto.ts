import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
import { UNIT_TYPES, UnitType } from './unit-rules';

export class CreateDepartmentDto {
  @ApiProperty({ enum: UNIT_TYPES, example: 'DEPARTMENT', description: 'ADR-14: Công ty, Trung tâm, Phòng, Nhóm' })
  @IsIn(UNIT_TYPES)
  unitType: UnitType;

  @ApiProperty({ example: 'ENG-PLT' })
  @Matches(/^[A-Z0-9-]{2,20}$/, { message: 'code chỉ gồm chữ in hoa, số, dấu gạch (2–20 ký tự)' })
  code: string;

  @ApiProperty({ example: 'Platform Engineering' })
  @IsString()
  @Length(2, 150)
  name: string;

  @ApiProperty({ example: 'Hà Nội' })
  @IsString()
  @Length(2, 50)
  office: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  headEmployeeId?: string | null;
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ enum: UNIT_TYPES })
  @IsOptional()
  @IsIn(UNIT_TYPES)
  unitType?: UnitType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 50)
  office?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  headEmployeeId?: string | null;
}

export interface UnitHead {
  id: string;
  fullName: string;
}

export interface DepartmentNode {
  id: string;
  code: string;
  name: string;
  office: string;
  unitType: UnitType;
  parentId: string | null;
  headEmployeeId: string | null;
  head: UnitHead | null;
  /** Số người đang làm việc thuộc trực tiếp đơn vị (không gồm đơn vị con). */
  memberCount: number;
  children: DepartmentNode[];
}

export interface UnitPathItem {
  id: string;
  name: string;
  unitType: UnitType;
  headEmployeeId: string | null;
}

export interface DepartmentDetail extends Omit<DepartmentNode, 'children'> {
  status: string;
  /** Từ gốc (Công ty) tới chính đơn vị. */
  path: UnitPathItem[];
}
