import { FileText, X } from 'lucide-react';
import { FormEvent, useRef, useState } from 'react';
import { ApiError, Department } from '../../api/client';
import {
  DOCUMENT_TYPES,
  DocumentAdmin,
  documentsApi,
  DocumentScope,
  DocumentType,
  fileSpecOf,
  TYPE_LABEL,
  uploadAndConfirm,
} from '../../api/documents';
import { formatSize } from '../../api/transfer';
import { errorText } from '../../components/ui';
import { useDialog } from '../../components/useDialog';
import { ScopePicker } from './ScopePicker';

/** `create`: đăng tài liệu mới; `edit`: sửa tiêu đề, loại, phạm vi; `version`: thêm phiên bản (chỉ có phần file). */
export type DialogMode = { kind: 'create' } | { kind: 'edit'; doc: DocumentAdmin } | { kind: 'version'; doc: DocumentAdmin };

type Field = 'title' | 'type' | 'scope' | 'file' | 'form';

/** Lỗi 400 của API theo trường (`fields`, AC-5.1.4) → ô trên form. */
function fieldErrors(e: ApiError): Partial<Record<Field, string>> {
  const out: Partial<Record<Field, string>> = {};
  for (const [k, msg] of Object.entries(e.fields ?? {})) {
    const f: Field = k === 'title' || k === 'type' ? k : k.startsWith('scope') ? 'scope' : ['fileName', 'contentType', 'sizeBytes'].includes(k) ? 'file' : 'form';
    out[f] ??= msg;
  }
  return Object.keys(out).length ? out : { form: e.message };
}

const HEADINGS: Record<DialogMode['kind'], string> = { create: 'Đăng tài liệu', edit: 'Sửa thông tin, phạm vi', version: 'Thêm phiên bản' };

/**
 * Hộp đăng tài liệu, sửa thông tin, thêm phiên bản (UC5 luồng chính, A2, A3; bản vẽ uc5-upload). File kiểm ở trình duyệt, PUT
 * thẳng lên storage có thanh tiến độ, xong thì tự xác nhận. Tải lên lỗi sau khi tài liệu đã tạo thì lần thử lại thêm phiên
 * bản cho chính tài liệu đó, không tạo tài liệu thứ hai.
 */
export function DocumentDialog({
  mode,
  units,
  onClose,
  onSaved,
}: {
  mode: DialogMode;
  units: Department[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useDialog(box, heading, onClose);

  const doc = mode.kind === 'create' ? null : mode.doc;
  const [title, setTitle] = useState(doc?.title ?? '');
  const [type, setType] = useState<DocumentType>(doc?.type ?? 'POLICY');
  const [scope, setScope] = useState<DocumentScope>(
    doc ? { all: doc.scope.all, departmentIds: doc.scope.departmentIds, roles: doc.scope.roles } : { all: false, departmentIds: [], roles: [] },
  );
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  /** Tài liệu vừa tạo nhưng tải file lỗi: thử lại thì thêm phiên bản cho tài liệu này. */
  const [createdId, setCreatedId] = useState<string | null>(null);

  const needsFile = mode.kind !== 'edit';
  const needsMeta = mode.kind !== 'version';
  const inactiveNames = Object.fromEntries((doc?.scope.departments ?? []).filter((d) => !d.active).map((d) => [d.id, d.name]));

  function validate(): Partial<Record<Field, string>> {
    const out: Partial<Record<Field, string>> = {};
    if (needsMeta && !title.trim()) out.title = 'Nhập tiêu đề';
    if (needsMeta && !scope.all && !scope.departmentIds.length && !scope.roles.length) out.scope = 'Chọn ít nhất một phạm vi xem';
    if (needsFile) {
      const spec = file ? fileSpecOf(file) : 'Chọn file PDF hoặc DOCX';
      if (typeof spec === 'string') out.file = spec;
    }
    return out;
  }

  async function upload(documentId: string, ticket: Parameters<typeof uploadAndConfirm>[1]) {
    setProgress(0);
    await uploadAndConfirm(documentId, ticket, file!, setProgress);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const local = validate();
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    try {
      if (mode.kind === 'edit') {
        await documentsApi.update(mode.doc.id, { version: mode.doc.version, title: title.trim(), type, scope });
      } else {
        const spec = fileSpecOf(file!) as Exclude<ReturnType<typeof fileSpecOf>, string>;
        const targetId = doc?.id ?? createdId;
        if (targetId) {
          await upload(targetId, await documentsApi.addVersion(targetId, spec));
        } else {
          const created = await documentsApi.create({ title: title.trim(), type, scope, ...spec });
          setCreatedId(created.document.id);
          await upload(created.document.id, created.upload);
        }
      }
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) setErrors(fieldErrors(err));
      else if (err instanceof ApiError) setErrors({ form: errorText(err) });
      else setErrors({ file: (err as Error).message });
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  const err = (f: Field) => errors[f] && <span className="field-error">{errors[f]}</span>;
  return (
    <div className="overlay" onMouseDown={(ev) => ev.target === ev.currentTarget && !saving && onClose()}>
      <div className="dialog wide" role="dialog" aria-modal="true" aria-labelledby="doc-dialog-title" ref={box}>
        <form onSubmit={submit} noValidate>
          <div className="dialog-head">
            <h2 id="doc-dialog-title" tabIndex={-1} ref={heading}>{HEADINGS[mode.kind]}</h2>
            <button type="button" className="icon-btn" aria-label="Đóng" disabled={saving} onClick={onClose}><X size={18} /></button>
          </div>
          <div className="dialog-body form-grid">
            {mode.kind === 'version' && <p className="span2 muted">{mode.doc.title}: bản mới thành phiên bản {nextVersionNo(mode.doc)}, bản cũ giữ nguyên.</p>}
            {needsMeta && (
              <>
                <label className="span2">
                  Tiêu đề *
                  <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!errors.title} />
                  {err('title')}
                </label>
                <label>
                  Loại *
                  <select value={type} onChange={(e) => setType(e.target.value as DocumentType)}>
                    {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                  </select>
                  {err('type')}
                </label>
                <div className="span2">
                  <ScopePicker value={scope} onChange={setScope} units={units} inactiveNames={inactiveNames} error={errors.scope} />
                </div>
              </>
            )}
            {needsFile && (
              <label className="span2">
                File * <span className="muted small">(PDF hoặc DOCX, tối đa 20 MiB)</span>
                <input
                  type="file"
                  accept=".pdf,.docx"
                  disabled={saving}
                  aria-invalid={!!errors.file}
                  onChange={(e) => (setFile(e.target.files?.[0] ?? null), setErrors((x) => ({ ...x, file: undefined })))}
                />
                {file && (
                  <span className="file-row">
                    <FileText size={18} aria-hidden="true" />
                    <span className="ellipsis">{file.name}</span>
                    <span className="muted small">{formatSize(file.size)}</span>
                  </span>
                )}
                {progress !== null && <progress max={100} value={progress} aria-label="Tiến độ tải lên" />}
                {err('file')}
              </label>
            )}
            {mode.kind === 'edit' && <p className="span2 note">Phạm vi mới áp dụng cho mọi phiên bản; người không còn trong phạm vi sẽ không tải được kể cả bản cũ.</p>}
            {errors.form && <p className="span2 error">{errors.form}</p>}
          </div>
          <div className="dialog-foot">
            <button type="button" disabled={saving} onClick={onClose}>Hủy</button>
            <button type="submit" className="primary" disabled={saving}>
              {progress !== null ? `Đang tải lên ${progress}%` : saving ? 'Đang lưu…' : mode.kind === 'edit' ? 'Lưu' : 'Đăng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function nextVersionNo(doc: DocumentAdmin): number {
  return Math.max(0, ...doc.versions.map((v) => v.versionNo)) + 1;
}
