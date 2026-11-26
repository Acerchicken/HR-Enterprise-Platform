import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DocumentModule } from '../document/document.module';
import { AssistantConfigController } from './assistant-config.controller';
import { AssistantConfigService } from './assistant-config.service';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

/**
 * Trợ lý chính sách (UC6): API chỉ là BFF, trả lời và cấu hình nhà cung cấp nằm ở assistant service (`services/assistant`, ADR-15,
 * ADR-16). API kiểm quyền, tính phạm vi người hỏi, ghi audit cấu hình (FR-6.4).
 */
@Module({
  imports: [DocumentModule, AuditModule],
  controllers: [AssistantController, AssistantConfigController],
  providers: [AssistantService, AssistantConfigService],
})
export class AssistantModule {}
