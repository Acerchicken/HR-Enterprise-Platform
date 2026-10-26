import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class CreateDepartmentDto {
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

export interface DepartmentNode {
  id: string;
  code: string;
  name: string;
  office: string;
  parentId: string | null;
  headEmployeeId: string | null;
  children: DepartmentNode[];
}
