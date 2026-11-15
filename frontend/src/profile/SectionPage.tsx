import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError, HistoryEntry, Page, PersonalSection, ProfileSummary, SalarySection, SectionSummary } from '../api/client';
import { invalidateSummary } from '../api/cache';
import { useApi } from '../api/useApi';
import { errorText, formatDate, formatMoney, MaskedValue, Skeleton, useCooldown } from '../components/ui';
import { FieldEditor, newKey, RequestBox } from './fields';
import { FilesSectionPage } from './FilesSectionPage';
import { RowSectionPage } from './RowSectionPage';

const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Đang làm việc', ON_LEAVE: 'Tạm nghỉ', TERMINATED: 'Đã nghỉ việc' };
const ROW_SECTIONS = new Set(['emergency-contacts', 'relatives', 'qualifications', 'bank-account']);

/** Trang con của một mục, mở bên trong popup (frontend.md 4.2). Chỉ lúc này mới gọi API của mục (AC-1.8.8). */
export function SectionPage({ summary, code, def }: { summary: ProfileSummary; code: string; def?: SectionSummary }) {
  // Mục chưa làm hoặc không được xem: không gọi API (AC-1.8.2).
  if (!def || !def.available) return <ComingSoon known={!!def} />;
  if (code === 'personal') return <Personal s={summary} />;
  if (code === 'salary') return <Salary s={summary} />;
  if (code === 'history') return <History s={summary} />;
  if (code === 'cv') return <FilesSectionPage s={summary} code={code} />;
  if (ROW_SECTIONS.has(code)) return <RowSectionPage s={summary} code={code} />;
  return <ComingSoon known />;
}

function ComingSoon({ known }: { known: boolean }) {
  return (
    <div className="pad coming">
      <h3>{known ? 'Chức năng đang phát triển' : 'Không tìm thấy hoặc bạn không có quyền xem.'}</h3>
      {known && <p className="muted">Mục này chưa có trong phiên bản hiện tại.</p>}
    </div>
  );
}

function Kv({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="kv">
      <span className="k">{k}</span>
      <span>{children}</span>
    </div>
  );
}

/** Nhân viên đề xuất sửa điện thoại, địa chỉ; HR xác nhận mới ghi vào hồ sơ (AC-1.2.1, FR-1.9). */
function Personal({ s }: { s: ProfileSummary }) {
  const data = useApi<PersonalSection>(() => api(`/employees/${s.id}/profile/personal`), [s.id]);
  const [editing, setEditing] = useState<{ values: Record<string, unknown>; key: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const d = data.data;
  const cooldown = useCooldown(error);

  useEffect(() => setEditing(null), [d]);

  async function run(fn: () => Promise<unknown>) {
    setSaving(true);
    setError(null);
    setErrors({});
    try {
      await fn();
      invalidateSummary(s.id);
      data.reload();
    } catch (e) {
      if (e instanceof ApiError && e.fields) setErrors(e.fields);
      setError(e as Error);
    } finally {
      setSaving(false);
    }
  }

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!d || !editing) return;
    // Chỉ gửi trường đã đổi.
    const proposed = Object.fromEntries(
      Object.entries(editing.values).filter(([k, v]) => (v ?? '') !== ((d as unknown as Record<string, unknown>)[k] ?? '')),
    );
    void run(() =>
      api(`/employees/${s.id}/change-requests`, {
        method: 'POST',
        headers: { 'Idempotency-Key': editing.key },
        body: JSON.stringify({ section: 'personal', action: 'UPDATE', proposed }),
      }),
    );
  }

  if (data.error) return <p className="error pad">{errorText(data.error)}</p>;
  if (!d) return <div className="pad"><Skeleton lines={6} /></div>;
  const pending = d.requests.find((r) => r.status === 'PENDING');
  return (
    <>
      <div className="fld">
        <Kv k="Mã nhân viên">{s.employeeCode}</Kv>
        <Kv k="Họ tên">{s.fullName}</Kv>
        <Kv k="Ngày sinh">{formatDate(d.dateOfBirth)}</Kv>
        <Kv k="Điện thoại">{d.phone ?? '—'}</Kv>
        <Kv k="Email công ty">{d.workEmail}</Kv>
        <Kv k="Địa chỉ">{d.address ?? '—'}</Kv>
        <Kv k="Ngày vào làm">{formatDate(d.hireDate)}</Kv>
        <Kv k="Trạng thái">{STATUS_LABEL[d.status] ?? d.status}</Kv>
        {d.nationalId && (
          <Kv k="CCCD">
            <MaskedValue
              label="CCCD"
              hasValue={d.nationalId.hasValue}
              load={() =>
                api<PersonalSection>(`/employees/${s.id}/profile/personal?reveal=true`).then((r) => r.nationalId?.value ?? null)
              }
            />
          </Kv>
        )}
        {d.requests.map((r) => (
          <RequestBox
            key={r.id}
            req={r}
            fields={d.fields}
            onCancel={() => void run(() => api(`/employees/${s.id}/change-requests/${r.id}`, { method: 'DELETE' }))}
            onDismiss={() => void run(() => api(`/employees/${s.id}/change-requests/${r.id}/acknowledge`, { method: 'POST' }))}
          />
        ))}
      </div>
      {d.canPropose && !editing && (
        <div className="pad">
          <button
            type="button"
            className="primary"
            onClick={() => setEditing({ values: { phone: pending?.proposed.phone ?? d.phone ?? '', address: pending?.proposed.address ?? d.address ?? '' }, key: newKey() })}
          >
            {pending ? 'Sửa yêu cầu đang chờ' : 'Sửa điện thoại, địa chỉ'}
          </button>
        </div>
      )}
      {editing && (
        <form className="fld form" onSubmit={submit}>
          {d.fields.map((f) => (
            <FieldEditor
              key={f.key}
              field={f}
              value={editing.values[f.key]}
              onChange={(v) => setEditing({ ...editing, values: { ...editing.values, [f.key]: v } })}
              error={errors[f.key]}
            />
          ))}
          {error && !Object.keys(errors).length && <p className="error">{errorText(error)}</p>}
          <div className="actions">
            <button className="primary" disabled={saving || cooldown > 0}>
              {saving ? 'Đang gửi…' : cooldown ? `Thử lại sau ${cooldown} giây` : 'Gửi yêu cầu'}
            </button>
            <button type="button" onClick={() => setEditing(null)}>Hủy</button>
          </div>
          <p className="muted small">Thay đổi chỉ vào hồ sơ sau khi HR xác nhận. Các trường khác do HR cập nhật.</p>
        </form>
      )}
    </>
  );
}

function Salary({ s }: { s: ProfileSummary }) {
  const data = useApi<SalarySection>(() => api(`/employees/${s.id}/profile/salary`), [s.id]);
  if (data.error) return <p className="error pad">{errorText(data.error)}</p>;
  if (!data.data) return <div className="pad"><Skeleton lines={2} /></div>;
  return (
    <div className="fld">
      <Kv k="Mức lương">
        <MaskedValue
          label="lương mục tiêu"
          hasValue={data.data.salary.hasValue}
          format={formatMoney}
          load={() => api<SalarySection>(`/employees/${s.id}/profile/salary?reveal=true`).then((r) => r.salary.value)}
        />
      </Kv>
      <p className="muted small">Lịch sử lương theo ngày hiệu lực sẽ có khi làm FR-1.12.</p>
    </div>
  );
}

const ACTION_TEXT: Record<string, string> = {
  CREATE: 'HR tạo hồ sơ',
  UPDATE: 'HR sửa trực tiếp',
  VIEW_SENSITIVE: 'Xem thông tin nhạy cảm',
  PROFILE_CHANGE_SUBMIT: 'Gửi yêu cầu cập nhật',
  PROFILE_CHANGE_CANCEL: 'Hủy yêu cầu',
  PROFILE_CHANGE_APPROVE: 'HR duyệt yêu cầu',
  PROFILE_CHANGE_REJECT: 'HR từ chối yêu cầu',
  PROFILE_ITEM_CREATE: 'HR thêm dòng',
  PROFILE_ITEM_UPDATE: 'HR sửa dòng',
  PROFILE_ITEM_DELETE: 'HR xóa dòng',
  PROFILE_FILE_UPLOAD: 'Tải file lên',
  PROFILE_FILE_DELETE: 'Xóa file',
  PROFILE_FILE_DOWNLOAD: 'HR tải file',
};

const DT = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

/** Lịch sử thay đổi hồ sơ (FR-1.11): thời điểm, người làm, thao tác, mục, tên trường; không có giá trị. */
function History({ s }: { s: ProfileSummary }) {
  const [page, setPage] = useState(1);
  const data = useApi<Page<HistoryEntry>>(() => api(`/employees/${s.id}/history?page=${page}&size=20`), [s.id, page]);
  const titles = new Map(s.sections.map((x) => [x.code, x.title]));
  if (data.error) return <p className="error pad">{errorText(data.error)}</p>;
  if (!data.data) return <div className="pad"><Skeleton lines={6} /></div>;
  const pages = Math.max(1, Math.ceil(data.data.total / data.data.size));
  return (
    <>
      <ul className="history">
        {data.data.items.map((h, i) => (
          <li key={i} className="fld">
            <div className="small muted">{DT.format(new Date(h.at))} · {h.actorName ?? 'Hệ thống'}</div>
            <div>
              <b>{ACTION_TEXT[h.action] ?? h.action}</b>
              {h.section && <> · {titles.get(h.section) ?? h.section}</>}
            </div>
            {h.fields.length > 0 && <div className="small muted">Trường: {h.fields.join(', ')}</div>}
          </li>
        ))}
      </ul>
      {data.data.items.length === 0 && <p className="pad muted">Chưa có thay đổi nào.</p>}
      <div className="pager pad">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Trước</button>
        <span>Trang {page}/{pages}</span>
        <button disabled={page >= pages} onClick={() => setPage(page + 1)}>Sau ›</button>
      </div>
    </>
  );
}
