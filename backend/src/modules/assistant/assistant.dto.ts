import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class AskQuestionDto {
  @ApiProperty({ example: 'Nghỉ cưới được mấy ngày?', minLength: 1, maxLength: 500 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 500)
  question: string;
}

export class AssistantCitation {
  @ApiProperty({ description: 'Số trích dẫn, khớp mốc [n] trong answer' }) n: number;
  @ApiProperty({ format: 'uuid' }) documentId: string;
  @ApiProperty() versionNo: number;
  @ApiProperty() title: string;
  @ApiProperty({ description: 'Mục, điều hoặc trang' }) section: string;
  @ApiProperty({ description: 'Đoạn trích (tối đa ~200 ký tự)' }) citedText: string;
}

export class AssistantDocumentRef {
  @ApiProperty({ format: 'uuid' }) documentId: string;
  @ApiProperty() title: string;
}

export class AssistantAnswer {
  @ApiProperty({ description: 'Câu trả lời có các mốc [n]; hoặc câu "không tìm thấy", "trợ lý đang bận"' }) answer: string;
  @ApiProperty({ type: [AssistantCitation] }) citations: AssistantCitation[];
  @ApiProperty({ description: 'true: không có câu trả lời của AI, xem documents (A2, E5)' }) fallback: boolean;
  @ApiProperty({ description: 'true: đã che dữ liệu cá nhân trong câu hỏi trước khi gửi (G1)' }) masked: boolean;
  @ApiPropertyOptional({ type: [AssistantDocumentRef], description: 'Chỉ có khi fallback = true' }) documents?: AssistantDocumentRef[];
}
