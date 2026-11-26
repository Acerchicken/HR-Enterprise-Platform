import { Controller, Get, Injectable } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { ProfileChangeService } from '../employee/profile-change.service';
import { CurrentUser } from '../identity/auth.decorators';
import { AuthUser, hasRole } from '../identity/roles';
import { LeaveRequestQuery } from './leave.dto';
import { LeaveService } from './leave.service';

/** Danh sách chờ của tab "Đơn nghỉ" đọc tối đa ngần này dòng mỗi nguồn để loại đơn trùng giữa hai nguồn (giống trang duyệt). */
const LEAVE_SCAN = 100;

export class TodoCountsResponse {
  @ApiPropertyOptional({ nullable: true, description: 'Tab "Đơn nghỉ": đơn chờ quyết định, đề nghị hủy; HR thêm đơn chờ HR duyệt thêm. null: không có tab này' })
  leave: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Tab "Hoàn tất đơn nghỉ" (HR): đơn đã duyệt chờ hoàn tất. null: không có tab này' })
  leaveComplete: number | null;

  @ApiPropertyOptional({ nullable: true, description: 'Tab "Sửa hồ sơ" (HR): yêu cầu cập nhật hồ sơ đang chờ, gồm file và ảnh đại diện. null: không có tab này' })
  profile: number | null;

  @ApiProperty({ description: 'Yêu cầu cập nhật hồ sơ của chính mình bị từ chối, chưa đóng thông báo' })
  myRejectedChanges: number;

  @ApiProperty({ description: 'Yêu cầu cập nhật hồ sơ của chính mình đang chờ HR (chỉ để hiện, không tính vào chuông)' })
  myPendingChanges: number;

  @ApiProperty({ description: 'Số trên chuông: tổng việc chờ chính mình xử lý (leave + leaveComplete + profile + myRejectedChanges)' })
  total: number;
}

/**
 * Số việc chờ cho chuông, dải "Việc cần làm" ở trang chủ và số trên từng tab của trang "Việc cần duyệt" (frontend.md 2.2, 2.4,
 * AC-0.2.2, AC-0.6.1). Đếm bằng chính các truy vấn của danh sách để số luôn khớp với số dòng người dùng thấy khi mở tab.
 */
@Injectable()
export class TodoCountsService {
  constructor(
    private readonly leave: LeaveService,
    private readonly changes: ProfileChangeService,
  ) {}

  async counts(user: AuthUser): Promise<TodoCountsResponse> {
    const isHr = hasRole(user, 'HR');
    const approver = isHr || hasRole(user, 'MANAGER');
    const own = user.employeeId;
    const [leave, leaveComplete, profile, myRejectedChanges, myPendingChanges] = await Promise.all([
      approver && own ? this.leaveCount(user, isHr) : null,
      isHr ? this.leave.all(query(1, 'APPROVED'), user).then((p) => p.total) : null,
      isHr ? this.changes.list({ status: 'PENDING', page: 1, size: 1 }).then((p) => p.total) : null,
      own ? this.changes.rejectedUnacknowledged(own) : 0,
      own ? this.changes.ownPending(own) : 0,
    ]);
    return {
      leave,
      leaveComplete,
      profile,
      myRejectedChanges,
      myPendingChanges,
      total: (leave ?? 0) + (leaveComplete ?? 0) + (profile ?? 0) + myRejectedChanges,
    };
  }

  /** Hợp của "chờ tôi duyệt" và (HR) "chờ HR duyệt thêm, đề nghị hủy": một đề nghị hủy có thể nằm ở cả hai nguồn. */
  private async leaveCount(user: AuthUser, isHr: boolean): Promise<number> {
    const [mine, hr] = await Promise.all([
      this.leave.pendingApproval(user, query(LEAVE_SCAN)),
      isHr ? this.leave.pendingHr(user, query(LEAVE_SCAN)) : null,
    ]);
    if (!hr) return mine.total;
    if (mine.total > LEAVE_SCAN || hr.total > LEAVE_SCAN) return mine.total + hr.total;
    return new Set([...mine.items, ...hr.items].map((r) => r.id)).size;
  }
}

function query(size: number, status?: LeaveRequestQuery['status']): LeaveRequestQuery {
  return Object.assign(new LeaveRequestQuery(), { page: 1, size, status });
}

@ApiTags('me')
@ApiBearerAuth()
@Controller()
export class TodoCountsController {
  constructor(private readonly todo: TodoCountsService) {}

  @Get('me/todo-counts')
  @ApiOkResponse({ type: TodoCountsResponse })
  counts(@CurrentUser() user: AuthUser): Promise<TodoCountsResponse> {
    return this.todo.counts(user);
  }
}
