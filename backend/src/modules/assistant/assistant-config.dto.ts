import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

/** UC6 FR-6.4, spec 9.2 "Cấu hình trợ lý". Khóa API chỉ đi vào (PUT, models, test), không bao giờ trả ra (AC-6.4.4). */
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Ô khóa để trống nghĩa là giữ khóa đã lưu. */
const emptyToUndefined = ({ value }: { value: unknown }) => (typeof value === 'string' && value.trim() === '' ? undefined : trim({ value }));

export class AssistantProviderInfo {
  @ApiProperty({ example: 'deepseek' }) id: string;
  @ApiProperty({ example: 'DeepSeek' }) name: string;
  @ApiProperty({ description: 'Nước nhận dữ liệu khi gửi câu hỏi (NFR-11.1)', example: 'Trung Quốc' }) dataRegion: string;
}

export class AssistantConfigView {
  @ApiProperty({ nullable: true, type: String, description: 'null: chưa cấu hình' }) provider: string | null;
  @ApiProperty({ nullable: true, type: String }) model: string | null;
  @ApiProperty({ nullable: true, type: String, description: '4 ký tự cuối của khóa API' }) apiKeyLast4: string | null;
  @ApiProperty() enabled: boolean;
  @ApiProperty({ description: 'Gửi lại khi lưu; chưa cấu hình là 0 (409 nếu cũ)' }) version: number;
  @ApiProperty({ nullable: true, type: String, format: 'uuid' }) updatedBy: string | null;
  @ApiProperty({ nullable: true, type: String }) updatedByName: string | null;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' }) updatedAt: string | null;
  @ApiProperty({ type: [AssistantProviderInfo] }) providers: AssistantProviderInfo[];
}

export class SaveAssistantConfigDto {
  @ApiProperty({ example: 'deepseek' })
  @Transform(trim)
  @IsString()
  @Length(1, 30)
  provider: string;

  @ApiProperty({ example: 'deepseek-chat' })
  @Transform(trim)
  @IsString()
  @Matches(/^[\w.:\-/@]{1,100}$/, { message: 'Chọn model' })
  model: string;

  @ApiPropertyOptional({ description: 'Bỏ trống để giữ khóa đã lưu (chỉ khi không đổi nhà cung cấp, A6)' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @Length(8, 500)
  apiKey?: string;

  @ApiProperty()
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  version: number;
}

export class ListModelsDto {
  @ApiProperty({ example: 'anthropic' })
  @Transform(trim)
  @IsString()
  @Length(1, 30)
  provider: string;

  @ApiPropertyOptional({ description: 'Không gửi thì dùng khóa đã lưu, chỉ khi cùng nhà cung cấp' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @Length(8, 500)
  apiKey?: string;
}

export class TestConnectionDto extends ListModelsDto {
  @ApiProperty({ example: 'deepseek-chat' })
  @Transform(trim)
  @IsString()
  @Matches(/^[\w.:\-/@]{1,100}$/, { message: 'Chọn model' })
  model: string;
}

export class AssistantModelInfo {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
}

export class AssistantModelList {
  @ApiProperty({ type: [AssistantModelInfo] }) models: AssistantModelInfo[];
}

export class ConnectionTestError {
  @ApiProperty({ enum: ['auth', 'timeout', 'rate_limit', 'bad_request', 'unavailable', 'refused'] }) kind: string;
  @ApiProperty() message: string;
}

export class ConnectionTestResult {
  @ApiProperty() ok: boolean;
  @ApiProperty() latencyMs: number;
  @ApiPropertyOptional({ type: ConnectionTestError }) error?: ConnectionTestError;
}
