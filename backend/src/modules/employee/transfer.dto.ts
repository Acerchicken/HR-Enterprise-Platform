import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsIn, IsOptional, IsString, IsUUID, Length, ValidateIf, ValidateNested } from 'class-validator';
import { AssignmentReason } from './employment-assignment.entity';

export const TRANSFER_REASONS = ['TRANSFER', 'PROMOTION', 'MANAGER_CHANGE', 'CORRECTION'] as const;

export class HeadChangeDto {
  @ApiProperty() @IsUUID() departmentId: string;

  @ApiProperty({ nullable: true, description: 'null: để trống có chủ ý' })
  @ValidateIf((o) => o.employeeId !== null)
  @IsUUID()
  employeeId: string | null;
}

export class ReportChoiceDto {
  @ApiProperty() @IsUUID() employeeId: string;

  @ApiProperty({ description: 'Quản lý mới của cấp dưới; giữ nguyên thì là chính người được điều chuyển' })
  @IsUUID()
  managerId: string;
}

/** UC2 FR-2.7: điều chuyển có ngày hiệu lực (spec mục 9.2). */
export class CreateTransferDto {
  @ApiProperty({ example: '2026-12-01', description: 'Hôm nay hoặc tương lai; quá khứ tối đa 30 ngày (AC-2.7.4)' })
  @IsDateString({ strict: true })
  effectiveDate: string;

  @ApiProperty() @IsUUID() departmentId: string;

  @ApiProperty() @IsUUID() positionId: string;

  @ApiProperty({ nullable: true, description: 'Chỉ CEO được để trống' })
  @ValidateIf((o) => o.managerId !== null)
  @IsUUID()
  managerId: string | null;

  @ApiProperty({ enum: TRANSFER_REASONS })
  @IsIn(TRANSFER_REASONS)
  reason: Exclude<AssignmentReason, 'HIRE'>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 500)
  note?: string;

  @ApiPropertyOptional({ type: [HeadChangeDto], description: 'AC-2.7.5: trưởng mới cho đơn vị người này đang làm trưởng' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => HeadChangeDto)
  newHeads?: HeadChangeDto[];

  @ApiPropertyOptional({ type: [ReportChoiceDto], description: 'AC-2.7.6: bắt buộc đủ mọi cấp dưới đang làm việc' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ReportChoiceDto)
  reports?: ReportChoiceDto[];
}

export interface TransferView {
  id: string;
  employeeId: string;
  status: string;
  reason: string;
  effectiveDate: string;
  departmentId: string;
  departmentName: string | null;
  positionId: string;
  positionTitle: string | null;
  managerId: string | null;
  managerName: string | null;
  note: string | null;
  failureReason: string | null;
  reports: { employeeId: string; fullName: string | null; managerId: string | null; status: string }[];
  createdAt: string;
}

export interface TerminationImpact {
  activeReports: number;
  headRoles: { departmentId: string; name: string; role: 'HEAD' | 'DEPUTY' }[];
  scheduledTransfers: number;
  pendingAsNewManager: { transferId: string; employeeName: string; effectiveDate: string }[];
}
