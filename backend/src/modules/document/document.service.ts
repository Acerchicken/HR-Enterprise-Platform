import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Readable } from 'stream';
import { DataSource, EntityManager } from 'typeorm';
import { fieldError } from '../../common/field-error';
import { Page } from '../../common/pagination';
import { AuditService } from '../audit/audit.service';
import { EmployeeService, RequestMeta } from '../employee/employee.service';
import { AuthUser } from '../identity/roles';
import { OrganizationService } from '../organization/organization.service';
import { checkDeclaredFile, matchesContent, MAX_FILE_BYTES, Viewer } from './document-rules';
import {
  CreateDocumentDto,
  DocumentAdminView,
  DocumentQuery,
  DocumentScopeDto,
  DocumentView,
  FileSpecDto,
  ManageDocumentQuery,
  UpdateDocumentDto,
  UploadTicket,
  VersionView,
} from './document.dto';
import { DocumentEntity, DocumentScope, DocumentVersion } from './document.entity';
import { writeDocumentEvent } from './document-events';
import { ObjectStorage } from './object-storage';

type Scope = { all: boolean; departmentIds: string[]; roles: string[] };

/** Có ít nhất một phiên bản `READY` (điều kiện để nhân viên thấy tài liệu). */
const HAS_READY = `EXISTS (SELECT 1 FROM document.document_version v WHERE v.document_id = d.id AND v.status = 'READY')`;

/** Escape ký tự đặc biệt của LIKE để từ khóa "50%" tìm đúng chữ. */
const likePattern = (q: string) => `%${q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/**
 * Tìm theo tiêu đề, không phân biệt hoa thường và dấu: "nghi phep" khớp "Quy chế nghỉ phép" (FR-5.4). Extension `unaccent` do
 * migration `AssistantSchema` tạo; `public.` để không phụ thuộc `search_path`.
 */
const TITLE_MATCH = 'public.unaccent(d.title) ILIKE public.unaccent(:q)';

/**
 * Kho tài liệu HR (UC5, docs/business/document-rules.md).
 * Quyền xem tính lại ở mỗi request từ phòng ban và vai trò hiện tại (DR-06) và lọc ngay trong truy vấn, nên tài liệu ngoài
 * phạm vi không lộ cả tiêu đề hay số lượng (DR-08). Tài liệu không xem được trả 404 như tài liệu không tồn tại.
 */
@Injectable()
export class DocumentService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly storage: ObjectStorage,
    private readonly employees: EmployeeService,
    private readonly org: OrganizationService,
    private readonly audit: AuditService,
  ) {}

  // ---------- Nhân viên: xem, tải ----------

  async list(actor: AuthUser, q: DocumentQuery): Promise<Page<DocumentView>> {
    const viewer = await this.viewer(actor);
    if (!viewer.active) return { items: [], page: q.page, size: q.size, total: 0 };
    const qb = this.visibleQuery(viewer).orderBy('d.updated_at', 'DESC').addOrderBy('d.title', 'ASC');
    if (q.type) qb.andWhere('d.type = :type', { type: q.type });
    if (q.q?.trim()) qb.andWhere(TITLE_MATCH, { q: likePattern(q.q) });
    const [docs, total] = await qb.skip((q.page - 1) * q.size).take(q.size).getManyAndCount();
    return { items: await this.views(docs, false), page: q.page, size: q.size, total };
  }

  async get(id: string, actor: AuthUser): Promise<DocumentView> {
    const doc = await this.visibleOrThrow(id, actor);
    const [view] = await this.views([doc], true);
    return view;
  }

  async download(id: string, versionId: string | null, actor: AuthUser): Promise<{ version: DocumentVersion; body: Readable }> {
    const doc = await this.visibleOrThrow(id, actor);
    const v = await this.ds.getRepository(DocumentVersion).findOne({
      where: versionId ? { id: versionId, documentId: doc.id, status: 'READY' } : { documentId: doc.id, status: 'READY' },
      order: { versionNo: 'DESC' },
    });
    if (!v) throw new NotFoundException('Không tìm thấy tài liệu');
    return { version: v, body: await this.storage.stream(v.objectKey) };
  }

  // ---------- HR: quản lý kho (DR-03) ----------

  async manageList(q: ManageDocumentQuery): Promise<Page<DocumentAdminView>> {
    const qb = this.ds.getRepository(DocumentEntity).createQueryBuilder('d').orderBy('d.updated_at', 'DESC').addOrderBy('d.title', 'ASC');
    if (q.type) qb.andWhere('d.type = :type', { type: q.type });
    if (q.q?.trim()) qb.andWhere(TITLE_MATCH, { q: likePattern(q.q) });
    if (q.state === 'VISIBLE') qb.andWhere(`d.hidden = false AND ${HAS_READY}`);
    if (q.state === 'HIDDEN') qb.andWhere('d.hidden = true');
    if (q.state === 'NOT_READY') qb.andWhere(`NOT ${HAS_READY}`);
    const [docs, total] = await qb.skip((q.page - 1) * q.size).take(q.size).getManyAndCount();
    return { items: await this.adminViews(docs), page: q.page, size: q.size, total };
  }

  async manageGet(id: string): Promise<DocumentAdminView> {
    const doc = await this.ds.getRepository(DocumentEntity).findOneBy({ id });
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu');
    return (await this.adminViews([doc]))[0];
  }

  async create(dto: CreateDocumentDto, actor: AuthUser, meta: RequestMeta = {}): Promise<{ document: DocumentAdminView; upload: UploadTicket }> {
    this.checkFile(dto);
    const scope = await this.checkScope(dto.scope, []);
    const { docId, ticket } = await this.ds.transaction(async (m) => {
      const doc = await m.getRepository(DocumentEntity).save(
        m.getRepository(DocumentEntity).create({ title: dto.title.trim(), type: dto.type, scopeAll: scope.all, hidden: false, createdBy: actor.employeeId }),
      );
      await this.saveScope(m, doc.id, scope);
      const ticket = await this.newVersion(m, doc.id, 1, dto, actor);
      await this.audit.record(
        { actorId: actor.employeeId, action: 'DOCUMENT_CREATE', entityType: 'document', entityId: doc.id, changedFields: { title: doc.title, type: doc.type, scope }, ...meta },
        m,
      );
      return { docId: doc.id, ticket };
    });
    return { document: await this.manageGet(docId), upload: ticket };
  }

  /** DR-04: đăng phiên bản mới, không ghi đè phiên bản cũ. */
  async addVersion(id: string, dto: FileSpecDto, actor: AuthUser): Promise<UploadTicket> {
    this.checkFile(dto);
    return this.ds.transaction(async (m) => {
      const doc = await m.getRepository(DocumentEntity).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!doc) throw new NotFoundException('Không tìm thấy tài liệu');
      const [{ max }] = await m.query('SELECT COALESCE(MAX(version_no), 0)::int AS max FROM document.document_version WHERE document_id = $1', [id]);
      return this.newVersion(m, id, max + 1, dto, actor);
    });
  }

  /**
   * Sau khi trình duyệt PUT file lên storage: kiểm file đã có, đúng dung lượng khai báo, đúng định dạng thực (DR-01).
   * Đạt thì phiên bản thành READY; không đạt thì xóa file, phiên bản REJECTED.
   */
  async confirm(id: string, versionId: string, actor: AuthUser, meta: RequestMeta = {}): Promise<DocumentAdminView> {
    const repo = this.ds.getRepository(DocumentVersion);
    const v = await repo.findOneBy({ id: versionId, documentId: id });
    if (!v) throw new NotFoundException('Không tìm thấy phiên bản');
    if (v.status === 'READY') return this.manageGet(id);
    if (v.status !== 'PENDING') throw new ConflictException('Phiên bản này đã bị từ chối, hãy tạo phiên bản mới');

    const obj = await this.storage.head(v.objectKey);
    if (!obj) throw new BadRequestException('Chưa có file trên kho, hãy tải file lên trước khi xác nhận');
    const problem =
      obj.size !== v.sizeBytes || obj.size > MAX_FILE_BYTES
        ? 'Dung lượng file không khớp khai báo hoặc vượt 20 MiB'
        : !matchesContent(v.fileName, await this.storage.readHead(v.objectKey))
          ? 'Nội dung file không đúng định dạng PDF/DOCX'
          : null;
    if (problem) {
      await this.storage.remove(v.objectKey).catch(() => undefined);
      await repo.update({ id: v.id }, { status: 'REJECTED' });
      throw new BadRequestException(problem);
    }
    await this.ds.transaction(async (m) => {
      await m.getRepository(DocumentVersion).update({ id: v.id }, { status: 'READY', readyAt: new Date() });
      await m.query('UPDATE document.document SET updated_at = now() WHERE id = $1', [id]);
      const doc = await m.getRepository(DocumentEntity).findOneByOrFail({ id });
      // UC5 13.2: assistant service index phiên bản mới (UC6).
      await writeDocumentEvent(m, 'DocumentPublished', {
        documentId: id,
        versionId: v.id,
        versionNo: v.versionNo,
        objectKey: v.objectKey,
        contentType: v.contentType,
        title: doc.title,
        type: doc.type,
        scope: await this.scopeOf(m, doc),
        hidden: doc.hidden,
        occurredAt: new Date().toISOString(),
      });
      await this.audit.record(
        { actorId: actor.employeeId, action: 'DOCUMENT_PUBLISH', entityType: 'document', entityId: id, changedFields: { versionNo: v.versionNo, fileName: v.fileName }, ...meta },
        m,
      );
    });
    return this.manageGet(id);
  }

  async update(id: string, dto: UpdateDocumentDto, actor: AuthUser, meta: RequestMeta = {}): Promise<DocumentAdminView> {
    await this.ds.transaction(async (m) => {
      const repo = m.getRepository(DocumentEntity);
      const doc = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!doc) throw new NotFoundException('Không tìm thấy tài liệu');
      if (doc.version !== dto.version) throw new ConflictException('Tài liệu đã được người khác cập nhật, hãy tải lại');
      const changes: Record<string, unknown> = {};
      if (dto.title !== undefined && dto.title.trim() !== doc.title) changes.title = doc.title = dto.title.trim();
      if (dto.type !== undefined && dto.type !== doc.type) changes.type = doc.type = dto.type;
      if (dto.scope) {
        const current = await m.getRepository(DocumentScope).findBy({ documentId: id });
        const before: Scope = {
          all: doc.scopeAll,
          departmentIds: current.filter((s) => s.kind === 'DEPARTMENT').map((s) => s.value),
          roles: current.filter((s) => s.kind === 'ROLE').map((s) => s.value),
        };
        // D3: đơn vị đã ngừng hoạt động chỉ được giữ nếu đã có sẵn trong phạm vi.
        const scope = await this.checkScope(dto.scope, before.departmentIds);
        if (!sameScope(before, scope)) {
          doc.scopeAll = scope.all;
          await m.getRepository(DocumentScope).delete({ documentId: id });
          await this.saveScope(m, id, scope);
          changes.scope = scope;
        }
      }
      if (!Object.keys(changes).length) return;
      await repo.save(doc);
      await writeDocumentEvent(m, 'DocumentUpdated', {
        documentId: id,
        title: doc.title,
        type: doc.type,
        scope: await this.scopeOf(m, doc),
        occurredAt: new Date().toISOString(),
      });
      await this.audit.record({ actorId: actor.employeeId, action: 'DOCUMENT_UPDATE', entityType: 'document', entityId: id, changedFields: changes, ...meta }, m);
    });
    return this.manageGet(id);
  }

  /** DR-05: gỡ là ẩn, giữ metadata và mọi phiên bản; chỉ HR khôi phục. */
  async setHidden(id: string, hidden: boolean, actor: AuthUser, meta: RequestMeta = {}): Promise<DocumentAdminView> {
    await this.ds.transaction(async (m) => {
      const res = await m.getRepository(DocumentEntity).update({ id }, { hidden });
      if (!res.affected) throw new NotFoundException('Không tìm thấy tài liệu');
      await writeDocumentEvent(m, hidden ? 'DocumentHidden' : 'DocumentRestored', { documentId: id, occurredAt: new Date().toISOString() });
      await this.audit.record({ actorId: actor.employeeId, action: hidden ? 'DOCUMENT_HIDE' : 'DOCUMENT_RESTORE', entityType: 'document', entityId: id, ...meta }, m);
    });
    return this.manageGet(id);
  }

  // ---------- Nội bộ ----------

  /** Người xem tính lại mỗi lần (DR-06): phòng ban hiện tại, các phòng ban cha, vai trò hiện tại. Trợ lý UC6 dùng chung. */
  async viewerOf(actor: AuthUser): Promise<Viewer> {
    return this.viewer(actor);
  }

  private async viewer(actor: AuthUser): Promise<Viewer> {
    const place = actor.employeeId ? await this.employees.placementOf(actor.employeeId) : null;
    if (!place || place.status === 'TERMINATED') return { active: false, departmentChain: [], roles: [] };
    return { active: true, departmentChain: await this.org.ancestorIds(place.departmentId), roles: actor.roles };
  }

  /** Điều kiện xem ở mức SQL (DR-02, DR-05, DR-08): chưa ẩn, có phiên bản sẵn sàng, khớp ít nhất một phạm vi. */
  private visibleQuery(viewer: Viewer) {
    return this.ds
      .getRepository(DocumentEntity)
      .createQueryBuilder('d')
      .where('d.hidden = false')
      .andWhere(HAS_READY)
      .andWhere(
        `(d.scope_all OR EXISTS (SELECT 1 FROM document.document_scope s WHERE s.document_id = d.id AND
          ((s.kind = 'DEPARTMENT' AND s.value = ANY(:depts)) OR (s.kind = 'ROLE' AND s.value = ANY(:roles)))))`,
        { depts: viewer.departmentChain.length ? viewer.departmentChain : [''], roles: viewer.roles.length ? viewer.roles : [''] },
      );
  }

  private async visibleOrThrow(id: string, actor: AuthUser): Promise<DocumentEntity> {
    const viewer = await this.viewer(actor);
    const doc = viewer.active ? await this.visibleQuery(viewer).andWhere('d.id = :id', { id }).getOne() : null;
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu');
    return doc;
  }

  private checkFile(f: FileSpecDto) {
    const problem = checkDeclaredFile(f.fileName, f.contentType, f.sizeBytes);
    if (problem) throw fieldError(problem.field, problem.message);
  }

  /**
   * DR-01, DR-02: ít nhất một phạm vi; đơn vị phải tồn tại và đang hoạt động (D3), trừ đơn vị đã có sẵn trong phạm vi cũ
   * (`keep`) để HR sửa tiêu đề hay vai trò không bị chặn vì một đơn vị vừa ngừng hoạt động.
   */
  private async checkScope(s: DocumentScopeDto, keep: readonly string[]): Promise<Scope> {
    const scope: Scope = { all: !!s.all, departmentIds: [...new Set(s.departmentIds ?? [])], roles: [...new Set(s.roles ?? [])] };
    if (!scope.all && !scope.departmentIds.length && !scope.roles.length) {
      throw fieldError('scope', 'Tài liệu phải có ít nhất một phạm vi xem');
    }
    const depts = (await this.org.lookups()).department;
    if (scope.departmentIds.some((d) => !depts.has(d))) throw fieldError('scope.departmentIds', 'Đơn vị không tồn tại');
    if (scope.departmentIds.some((d) => depts.get(d)!.status !== 'ACTIVE' && !keep.includes(d))) {
      throw fieldError('scope.departmentIds', 'Đơn vị đã ngừng hoạt động, hãy chọn đơn vị khác');
    }
    return scope;
  }

  /** Phạm vi hiện tại của tài liệu, cho payload event (assistant service không đọc schema `document`). */
  private async scopeOf(m: EntityManager, doc: DocumentEntity): Promise<Scope> {
    const rows = await m.getRepository(DocumentScope).findBy({ documentId: doc.id });
    return {
      all: doc.scopeAll,
      departmentIds: rows.filter((s) => s.kind === 'DEPARTMENT').map((s) => s.value),
      roles: rows.filter((s) => s.kind === 'ROLE').map((s) => s.value),
    };
  }

  private async saveScope(m: EntityManager, documentId: string, s: { departmentIds: string[]; roles: string[] }) {
    const rows = [
      ...s.departmentIds.map((value) => ({ documentId, kind: 'DEPARTMENT' as const, value })),
      ...s.roles.map((value) => ({ documentId, kind: 'ROLE' as const, value })),
    ];
    if (rows.length) await m.getRepository(DocumentScope).insert(rows);
  }

  private async newVersion(m: EntityManager, documentId: string, versionNo: number, f: FileSpecDto, actor: AuthUser): Promise<UploadTicket> {
    const repo = m.getRepository(DocumentVersion);
    const v = repo.create({
      documentId,
      versionNo,
      status: 'PENDING',
      objectKey: '',
      fileName: f.fileName,
      contentType: f.contentType,
      sizeBytes: f.sizeBytes,
      uploadedBy: actor.employeeId,
    });
    const saved = await repo.save(v);
    // Key không chứa tên file gốc, tránh ký tự lạ và lộ thông tin qua đường dẫn.
    saved.objectKey = `documents/${documentId}/${saved.id}.${f.fileName.toLowerCase().split('.').pop()}`;
    await repo.update({ id: saved.id }, { objectKey: saved.objectKey });
    const up = await this.storage.uploadUrl(saved.objectKey, f.contentType, f.sizeBytes);
    return { versionId: saved.id, versionNo, ...up };
  }

  private async versionsOf(ids: string[], readyOnly: boolean): Promise<Map<string, VersionView[]>> {
    const out = new Map<string, VersionView[]>();
    if (!ids.length) return out;
    const rows = await this.ds.getRepository(DocumentVersion).createQueryBuilder('v')
      .where('v.document_id IN (:...ids)', { ids })
      .andWhere(readyOnly ? `v.status = 'READY'` : '1=1')
      .orderBy('v.version_no', 'DESC')
      .getMany();
    for (const v of rows) {
      const list = out.get(v.documentId) ?? [];
      list.push({ id: v.id, versionNo: v.versionNo, fileName: v.fileName, contentType: v.contentType, sizeBytes: v.sizeBytes, status: v.status, createdAt: v.createdAt });
      out.set(v.documentId, list);
    }
    return out;
  }

  private async views(docs: DocumentEntity[], withVersions: boolean): Promise<DocumentView[]> {
    const versions = await this.versionsOf(docs.map((d) => d.id), true);
    return docs.map((d) => {
      const vs = versions.get(d.id) ?? [];
      return { id: d.id, title: d.title, type: d.type, updatedAt: d.updatedAt, latest: vs[0] ?? null, ...(withVersions ? { versions: vs } : {}) };
    });
  }

  private async adminViews(docs: DocumentEntity[]): Promise<DocumentAdminView[]> {
    const ids = docs.map((d) => d.id);
    const versions = await this.versionsOf(ids, false);
    const scopes: DocumentScope[] = ids.length
      ? await this.ds.getRepository(DocumentScope).createQueryBuilder('s').where('s.document_id IN (:...ids)', { ids }).getMany()
      : [];
    const depts = (await this.org.lookups()).department;
    return docs.map((d) => {
      const vs = versions.get(d.id) ?? [];
      const mine = scopes.filter((s) => s.documentId === d.id);
      const departmentIds = mine.filter((s) => s.kind === 'DEPARTMENT').map((s) => s.value);
      return {
        id: d.id,
        title: d.title,
        type: d.type,
        updatedAt: d.updatedAt,
        hidden: d.hidden,
        version: d.version,
        latest: vs.find((v) => v.status === 'READY') ?? null,
        versions: vs,
        scope: {
          all: d.scopeAll,
          departmentIds,
          roles: mine.filter((s) => s.kind === 'ROLE').map((s) => s.value),
          departments: departmentIds.map((id) => {
            const unit = depts.get(id);
            return { id, name: unit?.name ?? 'Đơn vị không còn', active: unit?.status === 'ACTIVE' };
          }),
        },
      };
    });
  }
}

/** Hai phạm vi giống nhau (không tính thứ tự): `PATCH` gửi lại phạm vi cũ thì không ghi audit, không đổi `version`. */
function sameScope(a: Scope, b: Scope): boolean {
  const same = (x: string[], y: string[]) => x.length === y.length && x.every((v) => y.includes(v));
  return a.all === b.all && same(a.departmentIds, b.departmentIds) && same(a.roles, b.roles);
}
