import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { RequestMeta } from '../employee/employee.service';
import { CurrentUser, Roles } from '../identity/auth.decorators';
import { AuthUser } from '../identity/roles';
import { CreateDocumentDto, DocumentQuery, FileSpecDto, UpdateDocumentDto } from './document.dto';
import { DocumentService } from './document.service';

const meta = (req: Request & { traceId?: string }): RequestMeta => ({ ip: req.ip ?? null, traceId: req.traceId ?? null });

/** RFC 5987: tên file tiếng Việt trong Content-Disposition. */
const disposition = (name: string) => `attachment; filename="${name.replace(/[^\x20-\x7e]|"/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`;

@ApiTags('documents')
@ApiBearerAuth()
@Controller()
export class DocumentController {
  constructor(private readonly docs: DocumentService) {}

  // ----- Mọi người dùng: chỉ tài liệu trong phạm vi (DR-02, DR-08) -----

  @Get('documents')
  list(@Query() q: DocumentQuery, @CurrentUser() user: AuthUser) {
    return this.docs.list(user, q);
  }

  @Get('documents/manage')
  @Roles('HR')
  manageList(@Query() q: DocumentQuery) {
    return this.docs.manageList(q);
  }

  @Get('documents/manage/:id')
  @Roles('HR')
  manageGet(@Param('id', ParseUUIDPipe) id: string) {
    return this.docs.manageGet(id);
  }

  @Get('documents/:id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.docs.get(id, user);
  }

  /** Tải phiên bản mới nhất; luôn qua API để kiểm quyền ở mỗi lần tải (DR-06). */
  @Get('documents/:id/download')
  async downloadLatest(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Res() res: Response) {
    return this.send(res, await this.docs.download(id, null, user));
  }

  @Get('documents/:id/versions/:versionId/download')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    return this.send(res, await this.docs.download(id, versionId, user));
  }

  // ----- Chỉ HR quản lý kho (DR-03) -----

  @Post('documents')
  @Roles('HR')
  create(@Body() dto: CreateDocumentDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.docs.create(dto, user, meta(req));
  }

  @Post('documents/:id/versions')
  @Roles('HR')
  addVersion(@Param('id', ParseUUIDPipe) id: string, @Body() dto: FileSpecDto, @CurrentUser() user: AuthUser) {
    return this.docs.addVersion(id, dto, user);
  }

  @Post('documents/:id/versions/:versionId/confirm')
  @HttpCode(200)
  @Roles('HR')
  confirm(@Param('id', ParseUUIDPipe) id: string, @Param('versionId', ParseUUIDPipe) versionId: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.docs.confirm(id, versionId, user, meta(req));
  }

  @Patch('documents/:id')
  @Roles('HR')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDocumentDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.docs.update(id, dto, user, meta(req));
  }

  @Post('documents/:id/hide')
  @HttpCode(200)
  @Roles('HR')
  hide(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.docs.setHidden(id, true, user, meta(req));
  }

  @Post('documents/:id/restore')
  @HttpCode(200)
  @Roles('HR')
  restore(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.docs.setHidden(id, false, user, meta(req));
  }

  private send(res: Response, f: Awaited<ReturnType<DocumentService['download']>>) {
    res.setHeader('Content-Type', f.version.contentType);
    res.setHeader('Content-Length', String(f.version.sizeBytes));
    res.setHeader('Content-Disposition', disposition(f.version.fileName));
    res.setHeader('Cache-Control', 'private, no-store');
    f.body.pipe(res);
  }
}
