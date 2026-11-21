import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator';
import { PageQuery } from '../../common/pagination';
import { HalfDay } from './leave-rules';
import { HistoryAction, LEAVE_STATUSES, LeaveStatus } from './leave-state-machine';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateLeaveRequestDto {
  @ApiProperty({ example: 'ANNUAL', description: 'Mã loại phép (GET /leave-types)' })
  @IsString()
  @Length(1, 20)
  leaveType: string;

  @ApiProperty({ example: '2026-12-09' })
  @Matches(DATE, { message: 'startDate phải có dạng YYYY-MM-DD' })
  startDate: string;

  @ApiProperty({ example: '2026-12-10' })
  @Matches(DATE, { message: 'endDate phải có dạng YYYY-MM-DD' })
  endDate: string;

  @ApiPropertyOptional({ enum: ['AM', 'PM'], description: 'Nghỉ nửa ngày (chỉ khi startDate = endDate)' })
  @IsOptional()
  @IsIn(['AM', 'PM'])
  halfDay?: HalfDay;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  reason?: string;

  @ApiPropertyOptional({ description: 'Ngày sự kiện: bắt buộc với loại nghỉ theo sự kiện, cấm với loại khác (AC-3.2.6)' })
  @IsOptional()
  @Matches(DATE, { message: 'eventDate phải có dạng YYYY-MM-DD' })
  eventDate?: string;

  @ApiPropertyOptional({ description: 'Chủ đơn khi HR, quản lý trực tiếp tạo hộ (BR-12); bỏ trống là chính người gọi' })
  @IsOptional()
  @IsUUID()
  employeeId?: string;
}

export class LeaveDecisionDto {
  @ApiProperty({ description: 'Version hiện tại của đơn (optimistic locking). Lệch → 409.' })
  @IsInt()
  version: number;

  @ApiPropertyOptional({ description: 'Ghi chú; bắt buộc khi từ chối, bác đề nghị hủy (E12). Chỉ lưu ở lịch sử đơn.' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  comment?: string;
}

export class CancelRequestDto {
  @ApiProperty()
  @IsInt()
  version: number;

  @ApiProperty({ description: 'Lý do đề nghị hủy; chỉ lưu ở lịch sử đơn' })
  @IsString()
  @Length(1, 500)
  reason: string;
}

export class RecalculateDto {
  @ApiProperty()
  @IsInt()
  version: number;

  @ApiProperty()
  @IsString()
  @Length(1, 500)
  reason: string;
}

export class LeaveRequestQuery extends PageQuery {
  @ApiPropertyOptional({ enum: LEAVE_STATUSES })
  @IsOptional()
  @IsIn(LEAVE_STATUSES)
  status?: LeaveStatus;
}

export class YearQuery {
  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}

export class BalanceQuery extends YearQuery {
  @ApiProperty()
  @IsUUID()
  employeeId: string;
}

export class AdjustBalanceDto {
  @ApiProperty()
  @IsInt()
  version: number;

  @ApiPropertyOptional({ enum: [12, 14, 16], description: 'Mức nền phép năm (chỉ ANNUAL)' })
  @IsOptional()
  @IsIn([12, 14, 16])
  baseDays?: number;

  @ApiPropertyOptional({ description: 'Hạn mức (chỉ loại YEARLY: SICK, UNPAID)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(366)
  entitled?: number;

  @ApiProperty({ description: 'Căn cứ, 1–200 ký tự (không vào audit)' })
  @IsString()
  @Length(1, 200)
  note: string;
}

export class CreateHolidayDto {
  @ApiProperty({ example: '2026-05-04' })
  @Matches(DATE, { message: 'date phải có dạng YYYY-MM-DD' })
  date: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({ enum: ['HOLIDAY', 'COMPENSATORY'] })
  @IsIn(['HOLIDAY', 'COMPENSATORY'])
  kind: 'HOLIDAY' | 'COMPENSATORY';
}

export class CreateDelegationDto {
  @ApiProperty({ description: 'Quản lý vắng' })
  @IsUUID()
  managerId: string;

  @ApiProperty({ description: 'Người duyệt thay' })
  @IsUUID()
  delegateId: string;

  @ApiProperty()
  @Matches(DATE)
  startDate: string;

  @ApiProperty()
  @Matches(DATE)
  endDate: string;
}

export class DelegationQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @ApiPropertyOptional({ description: 'Chỉ phân công hiệu lực trong ngày này' })
  @IsOptional()
  @Matches(DATE)
  activeOn?: string;
}

export interface LeaveHistoryView {
  action: HistoryAction;
  fromStatus: LeaveStatus | null;
  toStatus: LeaveStatus;
  actorId: string | null;
  actorName: string | null;
  comment: string | null;
  at: Date;
}

export interface LeaveRequestView {
  id: string;
  employeeId: string;
  employeeName: string | null;
  createdBy: string;
  leaveType: string | null;
  leaveTypeName: string | null;
  startDate: string;
  endDate: string;
  halfDay: HalfDay | null;
  eventDate: string | null;
  days: number;
  allocations: { year: number; days: number }[];
  /** null khi người xem không được thấy lý do (BR-14). */
  reason: string | null;
  reasonHidden: boolean;
  status: LeaveStatus;
  requiresHrApproval: boolean;
  approverId: string | null;
  cancelRequest: { requestedAt: Date; requestedBy: string | null } | null;
  completableFrom: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  /** Danh sách chờ duyệt: đơn cần quyết định hay đề nghị hủy; duyệt thay; quá mốc nhắc (UC4 9.3). */
  kind?: 'DECISION' | 'CANCEL_REQUEST';
  viaDelegation?: boolean;
  overdue?: boolean;
  history?: LeaveHistoryView[];
  canDecide?: boolean;
  canHrDecide?: boolean;
  canCancel?: boolean;
  canRequestCancel?: boolean;
  canConfirmCancel?: boolean;
  canComplete?: boolean;
}
