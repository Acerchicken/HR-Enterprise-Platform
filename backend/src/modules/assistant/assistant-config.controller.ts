import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../identity/auth.decorators';
import { AuthUser } from '../identity/roles';
import {
  AssistantConfigView,
  AssistantModelList,
  ConnectionTestResult,
  ListModelsDto,
  SaveAssistantConfigDto,
  TestConnectionDto,
} from './assistant-config.dto';
import { AssistantConfigService } from './assistant-config.service';

/** UC6 FR-6.4 (spec 4.2, 9.2): trang "Cấu hình trợ lý". Chỉ ADMIN, kể cả HR bị 403 (AC-6.4.6). */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/assistant-config')
@Roles('ADMIN')
export class AssistantConfigController {
  constructor(private readonly config: AssistantConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Xem cấu hình nhà cung cấp AI (không có khóa, chỉ 4 ký tự cuối)' })
  @ApiOkResponse({ type: AssistantConfigView })
  get(): Promise<AssistantConfigView> {
    return this.config.get();
  }

  @Put()
  @ApiOperation({ summary: 'Lưu cấu hình (AC-6.4.3, 6.4.5); version cũ trả 409' })
  @ApiOkResponse({ type: AssistantConfigView })
  save(@Body() dto: SaveAssistantConfigDto, @CurrentUser() user: AuthUser): Promise<AssistantConfigView> {
    return this.config.save(user, dto);
  }

  @Post('models')
  @HttpCode(200)
  @ApiOperation({ summary: 'Tải danh sách model từ nhà cung cấp (AC-6.4.1); khóa sai 400, nhà cung cấp không phản hồi 503' })
  @ApiOkResponse({ type: AssistantModelList })
  models(@Body() dto: ListModelsDto): Promise<AssistantModelList> {
    return this.config.listModels(dto);
  }

  @Post('test')
  @HttpCode(200)
  @ApiOperation({ summary: 'Kiểm tra kết nối (AC-6.4.2): lỗi của nhà cung cấp nằm trong `error`, HTTP vẫn 200' })
  @ApiOkResponse({ type: ConnectionTestResult })
  test(@Body() dto: TestConnectionDto, @CurrentUser() user: AuthUser): Promise<ConnectionTestResult> {
    return this.config.test(user, dto);
  }
}
