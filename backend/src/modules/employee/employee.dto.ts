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

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  address?: string;

  // ----- Trường nhạy cảm: mã hóa khi lưu, audit chỉ ghi tên trường -----
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
  positionId: string;
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

// ----- Trang hồ sơ theo mục (UC1 spec 9.1, AC-1.8.x) -----

export class ProfileSectionQuery {
  @ApiPropertyOptional({ description: 'true: giải mã giá trị nhạy cảm của mục (bấm mắt); mỗi lần gọi ghi audit VIEW_SENSITIVE' })
  @IsOptional()
  @IsIn(['true', 'false'])
  reveal?: 'true' | 'false';
}

export class SectionSummary {
  @ApiProperty({ example: 'personal' }) code: string;
  @ApiProperty({ enum: ['personal', 'work', 'finance', 'benefits', 'other'] }) group: string;
  @ApiProperty() title: string;
  @ApiProperty({ description: 'false: mục chưa làm, giao diện hiện tiêu đề đỏ "Chưa có" và không gọi API' }) available: boolean;
  @ApiProperty({ description: 'Số yêu cầu cập nhật đang chờ HR (luôn 0 cho tới khi có FR-1.9)' }) pendingRequests: number;
}

/** Đúng những gì trang hồ sơ mặc định hiện (AC-1.8.7): không có ngày sinh, địa chỉ, dòng của mục hay giá trị nhạy cảm. */
export class ProfileSummary {
  @ApiProperty() id: string;
  @ApiProperty() employeeCode: string;
  @ApiProperty() fullName: string;
  @ApiProperty({ nullable: true }) positionTitle: string | null;
  @ApiProperty() departmentId: string;
  @ApiProperty({ nullable: true }) departmentName: string | null;
  @ApiProperty({ nullable: true }) managerId: string | null;
  @ApiProperty({ nullable: true }) managerName: string | null;
  @ApiProperty({ nullable: true }) phone: string | null;
  @ApiProperty() workEmail: string;
  @ApiProperty({ enum: ['HR', 'OWNER', 'MANAGER', 'OTHER'] }) relation: 'HR' | 'OWNER' | 'MANAGER' | 'OTHER';
  @ApiProperty({ description: 'HR: hiện nút "Sửa hồ sơ"' }) canEdit: boolean;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Loại hợp đồng đang hiệu lực (hàng "Diện đối tượng", mức QL). null: chưa có dữ liệu. Không có trường này ở mức danh bạ',
  })
  contractType?: string | null;
  @ApiProperty({ type: [SectionSummary], description: 'Mục người xem được thấy, theo thứ tự trên trang' })
  sections: SectionSummary[];
}

/** Giá trị nhạy cảm: `value` chỉ có khi gọi với `reveal=true` và người xem được phép. */
export class MaskedField {
  @ApiProperty() hasValue: boolean;
  @ApiProperty({ nullable: true }) value: string | null;
}

export class PersonalSection {
  @ApiProperty({ example: 'personal' }) section: 'personal';
  @ApiProperty() version: number;
  @ApiProperty({ nullable: true }) phone: string | null;
  @ApiProperty() workEmail: string;
  @ApiProperty({ nullable: true }) address: string | null;
  @ApiProperty({ nullable: true }) dateOfBirth: string | null;
  @ApiProperty() hireDate: string;
  @ApiProperty({ enum: ['ACTIVE', 'ON_LEAVE', 'TERMINATED'] }) status: EmployeeStatus;
  @ApiPropertyOptional({ type: MaskedField, description: 'CCCD, chỉ HR' }) nationalId?: MaskedField;
}

export class SalarySection {
  @ApiProperty({ example: 'salary' }) section: 'salary';
  @ApiProperty({ type: MaskedField }) salary: MaskedField;
}

export class BankAccountSection {
  @ApiProperty({ example: 'bank-account' }) section: 'bank-account';
  @ApiProperty({ type: MaskedField }) bankAccount: MaskedField;
}

export type ProfileSectionData = PersonalSection | SalarySection | BankAccountSection;

export class MeEmployee {
  @ApiProperty() id: string;
  @ApiProperty() employeeCode: string;
  @ApiProperty() fullName: string;
}

/** `GET /me`: chỉ tài khoản, vai trò và hồ sơ gắn với tài khoản (mã, tên); dữ liệu hồ sơ lấy qua `summary` (AC-1.8.7). */
export class MeResponse {
  @ApiProperty() email: string;
  @ApiProperty({ type: [String] }) roles: string[];
  @ApiProperty({ type: MeEmployee, nullable: true }) employee: MeEmployee | null;
}
