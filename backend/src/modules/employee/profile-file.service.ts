import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { In, IsNull, LessThan, Not, Repository } from 'typeorm';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { S3Bucket } from '../../common/s3-bucket';
import { APP_CONFIG, AppConfig } from '../../config/config';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../identity/roles';
import { Employee } from './employee.entity';
import { RequestMeta } from './employee.service';
import { ProfileFile } from './profile-change.entity';
import { checkDeclared, checkQuota, FILE_SECTIONS, matchesContent, ORPHAN_HOURS, SHA256 } from './profile-file-rules';
import { resolveRelation } from './profile-sections';

/** Bucket riêng cho file hồ sơ (`PROFILE_STORAGE_BUCKET`). */
@Injectable()
export class ProfileStorage extends S3Bucket {
  constructor(@Inject(APP_CONFIG) cfg: AppConfig) {
    super(cfg.storage, cfg.profileStorage.bucket, 'Kho file hồ sơ chưa được cấu hình (PROFILE_STORAGE_BUCKET)');
  }
}

export interface FileView {
  id: string;
  section: string;
  itemId: string | null;
  name: string;
  contentType: string;
  size: number;
  status: string;
  uploadedByHr: boolean;
  createdAt: Date;
}

export const fileView = (f: ProfileFile): FileView => ({
  id: f.id,
  section: f.section,
  itemId: f.itemId,
  name: f.originalName,
  contentType: f.contentType,
  size: f.sizeBytes,
  status: f.status,
  uploadedByHr: f.uploadedByHr,
  createdAt: f.createdAt,
});

/**
 * File hồ sơ (UC1 FR-1.10, luồng 4.3, ADR-13): trình duyệt PUT thẳng lên storage bằng URL 10 phút; API kiểm nội dung khi xác
 * nhận; tải xuống luôn qua API. File nhân viên tải lên ở `PENDING_REVIEW` cho tới khi HR duyệt yêu cầu có kèm file (FR-1.9).
 */
@Injectable()
export class ProfileFileService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('ProfileFiles');
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(ProfileFile) private readonly files: Repository<ProfileFile>,
    @InjectRepository(Employee) private readonly employees: Repository<Employee>,
    private readonly storage: ProfileStorage,
    private readonly audit: AuditService,
    private readonly limiter: RateLimitService,
  ) {}

  onApplicationBootstrap() {
    // Dọn file tải lên nhưng không gắn vào yêu cầu nào sau 24 giờ.
    if (this.storage.configured) this.timer = setInterval(() => void this.cleanupOrphans().catch(() => undefined), 3_600_000);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  private async target(employeeId: string, viewer: AuthUser) {
    const e = await this.employees.findOneBy({ id: employeeId });
    if (!e) throw new NotFoundException('Không tìm thấy nhân viên');
    return { e, relation: await resolveRelation(this.employees, viewer, e) };
  }

  /** Bước 2–5 luồng 4.3: kiểm khai báo, hạn mức, trùng nội dung; tạo bản ghi `PENDING` và URL PUT. */
  async requestUpload(
    employeeId: string,
    viewer: AuthUser,
    input: { section: string; itemId?: string | null; fileName: string; contentType: string; size: number; sha256: string },
  ) {
    const { relation } = await this.target(employeeId, viewer);
    const conf = FILE_SECTIONS[input.section];
    // Chủ hồ sơ tải file cho mục NV; HR tải được cho mọi mục. Người khác: 404 như không tồn tại (E7).
    if (relation !== 'OWNER' && relation !== 'HR') throw new NotFoundException('Không tìm thấy hồ sơ');
    if (!conf) throw new BadRequestException('Mục này không nhận file');
    if (conf.by === 'HR' && relation !== 'HR') throw new ForbiddenException('File của mục này do HR tải lên');
    const declared = checkDeclared(input.section, input.fileName, input.contentType, input.size);
    if (declared) throw new BadRequestException(declared);
    if (!SHA256.test(input.sha256)) throw new BadRequestException('SHA-256 không hợp lệ');
    if (conf.item && input.itemId === undefined) throw new BadRequestException('Thiếu dòng gắn file');

    // AC-1.14.2: 10 URL/giờ, 30/ngày; đổi ảnh đại diện 5 lần/ngày.
    await this.limiter.consume(viewer.userId, 'profile-upload');
    if (input.section === 'avatar') await this.limiter.consume(viewer.userId, 'avatar-upload');

    // AC-1.10.4: đã có file READY cùng nội dung trong cùng mục thì trả file đó.
    const same = await this.files.findOneBy({ employeeId, section: input.section, sha256: input.sha256, status: 'READY' });
    if (same) return { file: fileView(same), existing: true as const };

    const [{ n, bytes }] = await this.files.query(
      `SELECT count(*)::int AS n, coalesce(sum(size_bytes), 0)::bigint AS bytes FROM employee.profile_file WHERE employee_id = $1 AND status = 'READY'`,
      [employeeId],
    );
    const quota = checkQuota(Number(n), Number(bytes), input.size);
    if (quota) throw new ConflictException(quota);

    const id = randomUUID();
    const key = `profiles/${employeeId}/${id}`;
    const upload = await this.storage.uploadUrl(key, input.contentType, input.size);
    const saved = await this.files.save(
      this.files.create({
        id,
        employeeId,
        section: input.section,
        itemId: input.itemId ?? null,
        storageKey: key,
        originalName: input.fileName.slice(0, 255),
        contentType: input.contentType,
        sizeBytes: input.size,
        sha256: input.sha256,
        status: 'PENDING',
        uploadedBy: viewer.employeeId ?? viewer.userId,
        uploadedByHr: relation === 'HR',
      }),
    );
    return { file: fileView(saved), existing: false as const, upload };
  }

  /** Bước 7–10 luồng 4.3: kiểm object thật (dung lượng, loại theo nội dung, SHA-256); ảnh đại diện cắt 512 × 512, bỏ EXIF. */
  async confirm(employeeId: string, fileId: string, viewer: AuthUser, meta: RequestMeta = {}) {
    const f = await this.files.findOneBy({ id: fileId, employeeId });
    if (!f || f.uploadedBy !== (viewer.employeeId ?? viewer.userId)) throw new NotFoundException('Không tìm thấy file');
    if (f.status !== 'PENDING') return fileView(f);
    const head = await this.storage.head(f.storageKey);
    // E13: chưa PUT lên storage thì file vẫn PENDING.
    if (!head) throw new BadRequestException('File chưa được tải lên storage');

    const reject = async (msg: string) => {
      await this.storage.remove(f.storageKey).catch(() => undefined);
      await this.files.update(f.id, { status: 'REJECTED' });
      throw new BadRequestException(msg);
    };
    if (head.size !== f.sizeBytes) return reject('Dung lượng file không khớp khai báo');
    if (!matchesContent(f.originalName, await this.storage.readHead(f.storageKey))) return reject('Nội dung file không khớp loại khai báo');
    if ((await this.storage.sha256(f.storageKey)) !== f.sha256) return reject('File tải lên không khớp mã SHA-256 khai báo');

    if (f.section === 'avatar') {
      // AC-1.10.3: cắt về 512 × 512, xoay theo EXIF rồi bỏ toàn bộ metadata (vị trí GPS).
      const sharp = (await import('sharp')).default;
      const out = await sharp(await this.storage.read(f.storageKey)).rotate().resize(512, 512, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
      await this.storage.put(f.storageKey, out, 'image/jpeg');
      f.contentType = 'image/jpeg';
      f.sizeBytes = out.length;
      f.sha256 = createHash('sha256').update(out).digest('hex');
    }
    // A8: HR tải lên thì READY ngay; nhân viên thì chờ HR duyệt yêu cầu kèm file.
    f.status = f.uploadedByHr ? 'READY' : 'PENDING_REVIEW';
    await this.files.save(f);
    await this.audit.record({
      actorId: viewer.employeeId,
      action: 'PROFILE_FILE_UPLOAD',
      entityType: 'employee',
      entityId: employeeId,
      // Không ghi tên file gốc (có thể chứa tên người, số CCCD).
      changedFields: { fileId: f.id, section: f.section, contentType: f.contentType, size: f.sizeBytes, sha256: f.sha256, fields: [] },
      ...meta,
    });
    return fileView(f);
  }

  /** File của một mục: chủ hồ sơ và HR (HR thấy cả file đã xóa trong 30 ngày). */
  async list(employeeId: string, section: string, viewer: AuthUser): Promise<FileView[]> {
    const { relation } = await this.target(employeeId, viewer);
    if (relation !== 'OWNER' && relation !== 'HR') throw new NotFoundException('Không tìm thấy hồ sơ');
    const statuses = relation === 'HR' ? ['READY', 'PENDING_REVIEW', 'DELETED'] : ['READY', 'PENDING_REVIEW'];
    const list = await this.files.find({ where: { employeeId, section, status: In(statuses) }, order: { createdAt: 'DESC' } });
    return list.map(fileView);
  }

  /** AC-1.10.5, 1.10.6: kiểm quyền rồi stream; người không có quyền nhận 404 như file không tồn tại. */
  async download(employeeId: string, fileId: string, viewer: AuthUser, meta: RequestMeta = {}) {
    const { relation } = await this.target(employeeId, viewer);
    const f = await this.files.findOneBy({ id: fileId, employeeId });
    const allowed =
      f &&
      ((relation === 'HR' && f.status !== 'PENDING') || (relation === 'OWNER' && (f.status === 'READY' || f.status === 'PENDING_REVIEW')));
    if (!f || !allowed) throw new NotFoundException('Không tìm thấy file');
    await this.limiter.consume(viewer.userId, 'profile-download');
    if (relation === 'HR' && viewer.employeeId !== employeeId) {
      await this.audit.record({
        actorId: viewer.employeeId,
        action: 'PROFILE_FILE_DOWNLOAD',
        entityType: 'employee',
        entityId: employeeId,
        changedFields: { fileId: f.id, section: f.section, fields: [] },
        ...meta,
      });
    }
    return { file: f, body: await this.storage.stream(f.storageKey) };
  }

  /** Ảnh đại diện đã duyệt: mọi người đăng nhập xem được (mức danh bạ). */
  async avatar(employeeId: string) {
    const e = await this.employees.findOne({ where: { id: employeeId }, select: { id: true, avatarFileId: true } });
    if (!e?.avatarFileId) throw new NotFoundException('Chưa có ảnh đại diện');
    const f = await this.files.findOneBy({ id: e.avatarFileId, status: 'READY' });
    if (!f) throw new NotFoundException('Chưa có ảnh đại diện');
    return { file: f, body: await this.storage.stream(f.storageKey) };
  }

  /** HR xóa trực tiếp (luồng 4.3): `DELETED`, HR vẫn tải được trong 30 ngày, sau đó lifecycle xóa object (AC-1.10.7). */
  async hrDelete(employeeId: string, fileId: string, hr: AuthUser, meta: RequestMeta = {}) {
    const f = await this.files.findOneBy({ id: fileId, employeeId, status: Not(In(['DELETED', 'REJECTED'])) });
    if (!f) throw new NotFoundException('Không tìm thấy file');
    await this.markDeleted([f]);
    if ((await this.employees.findOneBy({ id: employeeId, avatarFileId: f.id }))) {
      await this.employees.update(employeeId, { avatarFileId: null });
    }
    await this.audit.record({
      actorId: hr.employeeId,
      action: 'PROFILE_FILE_DELETE',
      entityType: 'employee',
      entityId: employeeId,
      changedFields: { fileId: f.id, section: f.section, contentType: f.contentType, size: f.sizeBytes, sha256: f.sha256, fields: [] },
      ...meta,
    });
  }

  async markDeleted(list: ProfileFile[]) {
    for (const f of list) {
      await this.files.update(f.id, { status: 'DELETED', deletedAt: new Date() });
      await this.storage.tag(f.storageKey, { deleted: 'true' }).catch((e) => this.logger.warn(`Không gắn được tag xóa: ${e?.name}`));
    }
  }

  /** File tải lên nhưng không gắn vào yêu cầu nào sau 24 giờ thì bị xóa (spec 4.3 bước 10). */
  async cleanupOrphans() {
    const old = new Date(Date.now() - ORPHAN_HOURS * 3_600_000);
    const list = await this.files.find({
      where: [
        { status: 'PENDING', createdAt: LessThan(old) },
        { status: 'PENDING_REVIEW', changeRequestId: IsNull(), createdAt: LessThan(old) },
      ],
      take: 200,
    });
    for (const f of list) {
      await this.storage.remove(f.storageKey).catch(() => undefined);
      await this.files.update(f.id, { status: 'REJECTED' });
    }
    if (list.length) this.logger.log(`Dọn ${list.length} file không gắn yêu cầu`);
  }

  /** Dùng khi gửi yêu cầu: file của chủ hồ sơ, đúng mục, đã xác nhận, chưa gắn yêu cầu đang chờ khác. */
  async assertAttachable(employeeId: string, section: string, fileIds: string[], viewer: AuthUser): Promise<ProfileFile[]> {
    if (!fileIds.length) return [];
    const list = await this.files.findBy({ id: In(fileIds), employeeId, section });
    const ok = list.filter((f) => f.status === 'PENDING_REVIEW' && f.uploadedBy === viewer.employeeId);
    if (ok.length !== new Set(fileIds).size) throw new BadRequestException('File đính kèm không hợp lệ hoặc chưa tải lên xong');
    return ok;
  }

  /** Yêu cầu xóa file: chỉ file đang dùng của chính mình; file HR tải lên thì 403 (E14). */
  async assertDeletable(employeeId: string, section: string, fileIds: string[]): Promise<ProfileFile[]> {
    const list = await this.files.findBy({ id: In(fileIds), employeeId, section, status: 'READY' });
    if (list.length !== new Set(fileIds).size) throw new NotFoundException('Không tìm thấy file');
    if (list.some((f) => f.uploadedByHr)) throw new ForbiddenException('Không xóa được file do HR tải lên');
    return list;
  }
}
