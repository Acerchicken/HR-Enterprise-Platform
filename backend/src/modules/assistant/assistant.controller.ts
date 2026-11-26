import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { RateLimit } from '../../common/rate-limit/rate-limit.interceptor';
import { CurrentUser } from '../identity/auth.decorators';
import { AuthUser } from '../identity/roles';
import { AskQuestionDto, AssistantAnswer } from './assistant.dto';
import { AssistantService } from './assistant.service';

@ApiTags('assistant')
@ApiBearerAuth()
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  /** UC6 FR-6.3: hỏi trợ lý chính sách. Mọi người đã đăng nhập; chỉ dùng tài liệu trong phạm vi của người hỏi. */
  @Post('questions')
  @HttpCode(200)
  @RateLimit('assistant')
  @ApiOperation({ summary: 'Hỏi trợ lý chính sách (UC6)', description: 'Không lưu câu hỏi. Giới hạn 10 câu/phút, 100 câu/ngày.' })
  @ApiOkResponse({ type: AssistantAnswer })
  @ApiTooManyRequestsResponse({ description: 'Quá 10 câu/phút hoặc 100 câu/ngày (E3)' })
  ask(@Body() dto: AskQuestionDto, @CurrentUser() user: AuthUser, @Req() req: Request & { traceId?: string }): Promise<AssistantAnswer> {
    return this.assistant.ask(user, dto.question, req.traceId ?? null);
  }
}
