import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PageQuery } from '../../common/pagination';
import { ROLES } from '../identity/roles';
import { DOCUMENT_TYPES, DocumentType } from './document.entity';
import { MAX_FILE_BYTES } from './document-rules';

/** Phạm vi xem (DR-02): toàn công ty, và/hoặc phòng ban (gồm phòng ban con), và/hoặc vai trò. Cộng dồn. */
export class DocumentScopeDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  all?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  departmentIds?: string[];

  @ApiPropertyOptional({ enum: ROLES, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(ROLES, { each: true })
  roles?: string[];
}

/** File sẽ tải lên (khai báo trước để ký presigned URL). */
export class FileSpecDto {
  @ApiProperty({ example: 'quy-che-lam-viec.pdf' })
  @IsString()
  @Length(5, 255)
  fileName: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  @Length(3, 100)
  contentType: string;

  @ApiProperty({ example: 4194304, maximum: MAX_FILE_BYTES })
  @IsInt()
  @Min(1)
  @Max(MAX_FILE_BYTES)
  sizeBytes: number;
}

export class CreateDocumentDto extends FileSpecDto {
  @ApiProperty({ example: 'Quy chế làm việc' })
  @IsString()
  @Length(1, 200)
  title: string;

  @ApiProperty({ enum: DOCUMENT_TYPES })
  @IsIn(DOCUMENT_TYPES)
  type: DocumentType;

  @ApiProperty({ type: DocumentScopeDto })
  @ValidateNested()
  @Type(() => DocumentScopeDto)
  scope: DocumentScopeDto;
}

export class UpdateDocumentDto {
  @ApiProperty({ description: 'Version hiện tại của tài liệu (optimistic locking). Lệch → 409.' })
  @IsInt()
  version: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @ApiPropertyOptional({ enum: DOCUMENT_TYPES })
  @IsOptional()
  @IsIn(DOCUMENT_TYPES)
  type?: DocumentType;

  @ApiPropertyOptional({ type: DocumentScopeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DocumentScopeDto)
  scope?: DocumentScopeDto;
}

export class DocumentQuery extends PageQuery {
  @ApiPropertyOptional({ enum: DOCUMENT_TYPES })
  @IsOptional()
  @IsIn(DOCUMENT_TYPES)
  type?: DocumentType;
}

export interface UploadTicket {
  versionId: string;
  versionNo: number;
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresInSeconds: number;
}

export interface VersionView {
  id: string;
  versionNo: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: string;
  createdAt: Date;
}

/** Nhân viên thấy: tài liệu trong phạm vi, các phiên bản đã sẵn sàng. */
export interface DocumentView {
  id: string;
  title: string;
  type: DocumentType;
  updatedAt: Date;
  latest: VersionView | null;
  versions?: VersionView[];
}

/** HR quản lý: thêm phạm vi, trạng thái ẩn, mọi phiên bản (chỉ metadata, DR-03). */
export interface DocumentAdminView extends DocumentView {
  hidden: boolean;
  version: number;
  scope: { all: boolean; departmentIds: string[]; roles: string[] };
}
