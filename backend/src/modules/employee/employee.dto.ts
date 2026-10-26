import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { PageQuery } from '../../common/pagination';
import { EmployeeStatus } from './employee.entity';

export class DirectoryQuery extends PageQuery {
  @ApiPropertyOptional({ description: 'Tìm theo tên, email hoặc mã nhân viên' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  q?: string;

  @ApiPropertyOptional({ description: 'Lọc theo phòng ban' })
  @IsOptional()
  @IsUUID()
  dept?: string;
}

export class ProfileQuery {
  @ApiPropertyOptional({ description: 'HR: kèm trường nhạy cảm (mỗi lần xem đều ghi audit)' })
  @IsOptional()
  @Type(() => String)
  @IsIn(['sensitive'])
  include?: 'sensitive';
}

const PHONE = /^\+?[0-9 .-]{8,20}$/;

/** Trường mà nhân viên tự sửa được trên hồ sơ của mình. */
export const SELF_EDITABLE = ['phone', 'address'] as const;

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ description: 'Version hiện tại (optimistic locking). Lệch → 409.' })
  @IsOptional()
  @IsInt()
  version?: number;

  @ApiPropertyOptional({ example: '0912 345 678' })
  @IsOptional()
  @Matches(PHONE, { message: 'Số điện thoại không hợp lệ' })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  address?: string;

  // ----- Chỉ HR -----
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 150)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  positionId?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  managerId?: string | null;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'ON_LEAVE', 'TERMINATED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'ON_LEAVE', 'TERMINATED'])
  status?: EmployeeStatus;

  @ApiPropertyOptional({ description: 'CCCD (12 số)' })
  @IsOptional()
  @Matches(/^[0-9]{12}$/, { message: 'CCCD phải gồm 12 chữ số' })
  nationalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[0-9]{6,20}$/, { message: 'Số tài khoản không hợp lệ' })
  bankAccount?: string;

  @ApiPropertyOptional({ description: 'Lương tháng (VND)' })
  @IsOptional()
  @IsNumberString()
  salary?: string;
}

export class CreateEmployeeDto {
  @ApiProperty({ example: 'E02001' })
  @Matches(/^E[0-9]{5}$/, { message: 'Mã nhân viên dạng E00001' })
  employeeCode: string;

  @ApiProperty()
  @IsString()
  @Length(2, 150)
  fullName: string;

  @ApiProperty()
  @IsEmail()
  workEmail: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(PHONE)
  phone?: string;

  @ApiProperty()
  @IsUUID()
  departmentId: string;

  @ApiProperty()
  @IsUUID()
  positionId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @ApiProperty({ example: '2026-11-01' })
  @IsDateString()
  hireDate: string;
}

export class SensitiveFields {
  nationalId: string | null;
  bankAccount: string | null;
  salary: string | null;
}

export class DirectoryEntry {
  id: string;
  employeeCode: string;
  fullName: string;
  workEmail: string;
  phone: string | null;
  departmentId: string;
  departmentName: string | null;
  positionTitle: string | null;
  managerId: string | null;
  managerName?: string | null;
}

export class EmployeeProfile extends DirectoryEntry {
  /** PUBLIC: danh bạ · PERSONAL: chính mình / quản lý trực tiếp · HR: kèm trường nhạy cảm khi yêu cầu */
  visibility: ViewLevel;
  dateOfBirth?: string | null;
  address?: string | null;
  hireDate?: string;
  status?: EmployeeStatus;
  version?: number;
  sensitive?: SensitiveFields;
}

export type ViewLevel = 'PUBLIC' | 'PERSONAL' | 'HR';
