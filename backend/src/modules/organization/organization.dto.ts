import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator';
import { UNIT_STATUSES, UNIT_TYPES, UnitStatus, UnitType } from './unit-rules';

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

  @ApiPropertyOptional({ description: 'FR-2.9: trưởng là "Quyền trưởng"' })
  @IsOptional()
  @IsBoolean()
  headActing?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Phó đơn vị (thay cả danh sách); tối đa theo loại: Công ty 5, Trung tâm 3, Phòng 3, Nhóm 0' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUUID('all', { each: true })
  deputyEmployeeIds?: string[];
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

  @ApiPropertyOptional({ description: 'FR-2.9: trưởng là "Quyền trưởng"' })
  @IsOptional()
  @IsBoolean()
  headActing?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Phó đơn vị (thay cả danh sách); tối đa theo loại: Công ty 5, Trung tâm 3, Phòng 3, Nhóm 0' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUUID('all', { each: true })
  deputyEmployeeIds?: string[];

  @ApiPropertyOptional({ enum: UNIT_STATUSES, description: 'INACTIVE: ngừng hoạt động (FR-2.10), chỉ khi đơn vị đã trống' })
  @IsOptional()
  @IsIn(UNIT_STATUSES)
  status?: UnitStatus;
}

export interface UnitHead {
  id: string;
  fullName: string;
  /** "Quyền trưởng" (FR-2.9). */
  acting: boolean;
}

export interface UnitDeputy {
  id: string;
  fullName: string;
  positionTitle: string | null;
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
  status: UnitStatus;
  headActing: boolean;
  deputies: UnitDeputy[];
  /** Từ gốc (Công ty) tới chính đơn vị. */
  path: UnitPathItem[];
}

// ---------- Chức danh (FR-2.6) ----------

export class PositionQuery {
  @ApiPropertyOptional({ description: 'true: chỉ chức danh đang dùng (danh sách chọn)' })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  active?: boolean;
}

export class CreatePositionDto {
  @ApiProperty({ example: 'PM' })
  @Matches(/^[A-Z0-9-]{2,20}$/, { message: 'code chỉ gồm chữ in hoa, số, dấu gạch (2–20 ký tự)' })
  code: string;

  @ApiProperty({ example: 'Quản lý dự án' })
  @IsString()
  @Length(2, 100)
  title: string;

  @ApiProperty({ minimum: 1, maximum: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  level: number;
}

export class UpdatePositionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 100)
  title?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  level?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export interface PositionView {
  id: string;
  code: string;
  title: string;
  level: number;
  active: boolean;
  system: boolean;
  /** Số nhân viên đang làm việc giữ chức danh này. */
  holderCount: number;
}
