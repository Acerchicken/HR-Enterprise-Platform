import { FormEvent, useEffect, useState } from 'react';
import {
  api,
  ApiError,
  BankAccountSection,
  PersonalSection,
  ProfileSummary,
  SalarySection,
  SectionSummary,
} from '../api/client';
import { invalidateSummary } from '../api/cache';
import { useApi } from '../api/useApi';
import { errorText, formatDate, formatMoney, MaskedValue, Skeleton } from '../components/ui';
import { formFields } from '../pages/employee/employee-fields';
import { FieldInput } from '../pages/employee/FieldInput';

const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Đang làm việc', ON_LEAVE: 'Tạm nghỉ', TERMINATED: 'Đã nghỉ việc' };

/** Trang con của một mục, mở bên trong popup (frontend.md 4.2). Chỉ lúc này mới gọi API của mục (AC-1.8.8). */
export function SectionPage({ summary, code, def }: { summary: ProfileSummary; code: string; def?: SectionSummary }) {
  // Mục chưa làm hoặc không được xem: không gọi API (AC-1.8.2).
  if (!def || !def.available) return <ComingSoon known={!!def} />;
  if (code === 'personal') return <Personal s={summary} />;
  if (code === 'salary') return <Salary s={summary} />;
  if (code === 'bank-account') return <BankAccount s={summary} />;
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

function useSection<T>(s: ProfileSummary, code: string) {
  return useApi<T>(() => api<T>(`/employees/${s.id}/profile/${code}`), [s.id, code]);
}

function Kv({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="kv">
      <span className="k">{k}</span>
      <span>{children}</span>
    </div>
  );
}

/** Nhân viên tự sửa điện thoại, địa chỉ: tạm lưu thẳng cho tới khi có `feat/profile-change-requests` (quyết định 14/11). */
const SELF_FIELDS = formFields('edit', 'SELF');

function Personal({ s }: { s: ProfileSummary }) {
  const data = useSection<PersonalSection>(s, 'personal');
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({ phone: '', address: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const d = data.data;

  useEffect(() => {
    if (d) setValues({ phone: d.phone ?? '', address: d.address ?? '' });
  }, [d]);

  async function save(ev: FormEvent) {
    ev.preventDefault();
    if (!d) return;
    setSaving(true);
    setError(null);
    setErrors({});
    try {
      await api(`/employees/${s.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ phone: values.phone || undefined, address: values.address, version: d.version }),
      });
      invalidateSummary(s.id);
      setEditing(false);
      data.reload();
    } catch (e) {
      if (e instanceof ApiError && e.fields) setErrors(e.fields);
      setError(e as Error);
    } finally {
      setSaving(false);
    }
  }

  if (data.error) return <p className="error pad">{errorText(data.error)}</p>;
  if (!d) return <div className="pad"><Skeleton lines={6} /></div>;
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
      </div>
      {s.relation === 'OWNER' && !editing && (
        <div className="pad">
          <button type="button" className="primary" onClick={() => setEditing(true)}>Sửa điện thoại, địa chỉ</button>
        </div>
      )}
      {s.relation === 'OWNER' && editing && (
        <form className="fld form" onSubmit={save}>
          {SELF_FIELDS.map((f) => (
            <FieldInput
              key={f.key}
              field={f}
              value={values[f.key as 'phone' | 'address']}
              onChange={(v) => setValues((x) => ({ ...x, [f.key]: v }))}
              error={errors[f.key]}
              lookups={{ departments: [], positions: [] }}
            />
          ))}
          {error && !Object.keys(errors).length && <p className="error">{errorText(error)}</p>}
          <div className="actions">
            <button className="primary" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu'}</button>
            <button type="button" onClick={() => setEditing(false)}>Hủy</button>
          </div>
          <p className="muted small">Các trường khác do HR cập nhật.</p>
        </form>
      )}
    </>
  );
}

function Salary({ s }: { s: ProfileSummary }) {
  const data = useSection<SalarySection>(s, 'salary');
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

function BankAccount({ s }: { s: ProfileSummary }) {
  const data = useSection<BankAccountSection>(s, 'bank-account');
  if (data.error) return <p className="error pad">{errorText(data.error)}</p>;
  if (!data.data) return <div className="pad"><Skeleton lines={2} /></div>;
  return (
    <div className="fld">
      <Kv k="Số tài khoản">
        <MaskedValue
          label="số tài khoản"
          hasValue={data.data.bankAccount.hasValue}
          load={() =>
            api<BankAccountSection>(`/employees/${s.id}/profile/bank-account?reveal=true`).then((r) => r.bankAccount.value)
          }
        />
      </Kv>
      <p className="muted small">Ngân hàng, chi nhánh, chủ tài khoản sẽ có khi nhân viên tự khai (FR-1.9).</p>
    </div>
  );
}
