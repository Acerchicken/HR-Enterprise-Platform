import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Length, Matches, Min } from 'class-validator';
import { Request, Response } from 'express';
import { Readable } from 'stream';
import { CurrentUser, Roles } from '../identity/auth.decorators';
import { AuthUser } from '../identity/roles';
import { RequestMeta } from './employee.service';
import { ProfileFile } from './profile-change.entity';
import { ProfileFileService } from './profile-file.service';

const meta = (req: Request & { traceId?: string }): RequestMeta => ({ ip: req.ip ?? null, traceId: req.traceId ?? null });

/** RFC 5987: tên file tiếng Việt trong Content-Disposition. */
const disposition = (kind: 'attachment' | 'inline', name: string) =>
  `${kind}; filename="${name.replace(/[^\x20-\x7e]|"/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`;

export class UploadRequestDto {
  @ApiProperty({ example: 'cv' })
  @Matches(/^[a-z-]{2,40}$/)
  section: string;

  @ApiPropertyOptional({ nullable: true, description: 'Dòng gắn file (bằng cấp, người phụ thuộc); null khi đính kèm dòng mới' })
  @IsOptional()
  @IsUUID()
  itemId?: string | null;

  @ApiProperty({ example: 'cv.pdf' })
  @IsString()
  @Length(1, 255)
  fileName: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  @Length(1, 100)
  contentType: string;

  @ApiProperty({ example: 102400 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  size: number;

  @ApiProperty({ description: 'SHA-256 hex do trình duyệt tính' })
  @Matches(/^[0-9a-f]{64}$/)
  sha256: string;
}

export class FileListQuery {
  @ApiProperty({ example: 'cv' })
  @Matches(/^[a-z-]{2,40}$/)
  section: string;
}

/** File hồ sơ (UC1 FR-1.10, luồng 4.3, ADR-13). */
@ApiTags('employee')
@ApiBearerAuth()
@Controller()
export class ProfileFileController {
  constructor(private readonly files: ProfileFileService) {}

  @Post('employees/:id/files')
  requestUpload(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UploadRequestDto, @CurrentUser() user: AuthUser) {
    return this.files.requestUpload(id, user, dto);
  }

  @Post('employees/:id/files/:fileId/confirm')
  @HttpCode(200)
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.files.confirm(id, fileId, user, meta(req));
  }

  @Get('employees/:id/files')
  list(@Param('id', ParseUUIDPipe) id: string, @Query() q: FileListQuery, @CurrentUser() user: AuthUser) {
    return this.files.list(id, q.section, user);
  }

  /** AC-1.10.5: luôn qua API, `attachment` và `nosniff`, response không chứa link storage. */
  @Get('employees/:id/files/:fileId/download')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const f = await this.files.download(id, fileId, user, meta(req));
    this.send(res, f, 'attachment');
  }

  /** Ảnh đại diện đã duyệt (mức danh bạ). */
  @Get('employees/:id/avatar')
  async avatar(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const f = await this.files.avatar(id);
    this.send(res, f, 'inline');
  }

  @Delete('employees/:id/files/:fileId')
  @Roles('HR')
  @HttpCode(204)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    await this.files.hrDelete(id, fileId, user, meta(req));
  }

  private send(res: Response, f: { file: ProfileFile; body: Readable }, kind: 'attachment' | 'inline') {
    res.setHeader('Content-Type', f.file.contentType);
    res.setHeader('Content-Length', String(f.file.sizeBytes));
    res.setHeader('Content-Disposition', disposition(kind, kind === 'inline' ? 'avatar.jpg' : f.file.originalName));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    f.body.pipe(res);
  }
}
