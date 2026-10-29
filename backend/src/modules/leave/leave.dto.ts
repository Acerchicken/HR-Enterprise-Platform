import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';
import { PageQuery } from '../../common/pagination';
import { HalfDay } from './leave-rules';
import { LeaveStatus } from './leave-state-machine';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: LeaveStatus[] = ['SUBMITTED', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'];

export class CreateLeaveRequestDto {
  @ApiProperty({ example: 'ANNUAL', description: 'Mã loại phép (GET /leave-types)' })
  @IsString()
  @Length(1, 20)
  leaveType: string;

  @ApiProperty({ example: '2026-11-09' })
  @Matches(DATE, { message: 'startDate phải có dạng YYYY-MM-DD' })
  startDate: string;

  @ApiProperty({ example: '2026-11-10' })
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
}

export class LeaveDecisionDto {
  @ApiProperty({ description: 'Version hiện tại của đơn (optimistic locking). Lệch → 409.' })
  @IsInt()
  version: number;

  @ApiPropertyOptional({ description: 'Ghi chú, ví dụ lý do từ chối' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  comment?: string;
}

export class LeaveRequestQuery extends PageQuery {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: LeaveStatus;
}

export class HolidayQuery {
  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}

export interface LeaveHistoryView {
  fromStatus: LeaveStatus | null;
  toStatus: LeaveStatus;
  actorId: string;
  actorName: string | null;
  comment: string | null;
  at: Date;
}

export interface LeaveRequestView {
  id: string;
  employeeId: string;
  employeeName: string | null;
  leaveType: string | null;
  startDate: string;
  endDate: string;
  halfDay: HalfDay | null;
  days: number;
  reason: string | null;
  status: LeaveStatus;
  approverId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  history?: LeaveHistoryView[];
}
