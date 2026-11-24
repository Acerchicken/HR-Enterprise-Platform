import { Module } from '@nestjs/common';
import { DocumentModule } from '../document/document.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

/** Trợ lý chính sách (UC6): API chỉ là BFF, trả lời nằm ở assistant service (`services/assistant`, ADR-15, ADR-16). */
@Module({
  imports: [DocumentModule],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
