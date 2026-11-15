import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { api, ApiError, Department, DirectoryEntry, EmployeeProfile, Me, Position } from '../../api/client';
import { invalidateSummary } from '../../api/cache';
import { useApi } from '../../api/useApi';
import { ErrorBox } from '../../components/ErrorBox';
import { CreateEmployeeBody, FieldGroup, FieldKey, formFields, GROUP_LABEL, UpdateEmployeeBody } from './employee-fields';
import { FieldInput } from './FieldInput';

type Values = Partial<Record<FieldKey, string>>;

/** HR tạo nhân viên (/employees/new) và sửa hồ sơ (/employees/:id/edit) bằng cùng một form (FR-1.4, FR-1.5). */
export function EmployeeFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const me = useOutletContext<Me | null>();
  const isHr = !!me?.roles.includes('HR');

  const departments = useApi(() => api<Department[]>('/departments'), []);
  const positions = useApi(() => api<Position[]>('/positions'), []);
  const current = useApi(
    // AC-1.3.4: mở form không tải giá trị nhạy cảm; chỉ tải khi HR bấm "Hiện giá trị hiện tại" (có audit).
    () => (mode === 'edit' ? api<EmployeeProfile>(`/employees/${id}`) : Promise.resolve(null)),
    [mode, id],
  );

  const fields = useMemo(() => formFields(mode, 'HR'), [mode]);
  const [values, setValues] = useState<Values>({});
  const [initial, setInitial] = useState<Values>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [suggested, setSuggested] = useState<DirectoryEntry | null>(null);

  // Nạp giá trị hiện tại khi sửa.
  useEffect(() => {
    const e = current.data;
    if (!e) return;
    const v: Values = {
      fullName: e.fullName, workEmail: e.workEmail, hireDate: e.hireDate ?? '', phone: e.phone ?? '', dateOfBirth: e.dateOfBirth ?? '', address: e.address ?? '',
      departmentId: e.departmentId, positionId: e.positionId ?? '', managerId: e.managerId ?? '', status: e.status ?? '',
    };
    setValues(v);
    setInitial(v);
  }, [current.data]);

  // Gợi ý quản lý: trưởng phòng của phòng ban đang chọn.
  const deptId = values.departmentId;
  useEffect(() => {
    const head = departments.data?.find((d) => d.id === deptId)?.headEmployeeId;
    if (!head) return setSuggested(null);
    api<DirectoryEntry>(`/employees/${head}`).then(setSuggested).catch(() => setSuggested(null));
  }, [deptId, departments.data]);

  const set = (k: FieldKey) => (v: string) => setValues((s) => ({ ...s, [k]: v }));
  const [revealing, setRevealing] = useState(false);
  const [revealed, setRevealed] = useState(false);

  /** Bấm mới tải giá trị nhạy cảm hiện tại vào form; mỗi lần tải có audit VIEW_SENSITIVE. */
  async function reveal() {
    setRevealing(true);
    try {
      const e = await api<EmployeeProfile>(`/employees/${id}?include=sensitive`);
      const v = { nationalId: e.sensitive?.nationalId ?? '', bankAccount: e.sensitive?.bankAccount ?? '', salary: e.sensitive?.salary ?? '' };
      setValues((s) => ({ ...s, ...v }));
      setInitial((s) => ({ ...s, ...v }));
      setRevealed(true);
    } catch (e) {
      setError(e as Error);
    } finally {
      setRevealing(false);
    }
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      if (mode === 'create') {
        const body: Record<string, string> = {};
        for (const f of fields) if (values[f.key]) body[f.key] = values[f.key]!;
        const created = await api<EmployeeProfile>('/employees', { method: 'POST', body: JSON.stringify(body as unknown as CreateEmployeeBody) });
        navigate(`/employees/${created.id}`);
      } else {
        // Chỉ gửi trường đã đổi; managerId rỗng gửi null (backend chỉ cho phép với CEO).
        const body: Record<string, string | number | null> = { version: current.data!.version! };
        for (const f of fields) {
          if ((values[f.key] ?? '') === (initial[f.key] ?? '')) continue;
          body[f.key] = values[f.key] ? values[f.key]! : f.key === 'managerId' ? null : '';
          if (body[f.key] === '') delete body[f.key];
        }
        await api<EmployeeProfile>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(body as unknown as UpdateEmployeeBody) });
        invalidateSummary(id!);
        navigate(`/employees/${id}`);
      }
    } catch (e) {
      if (e instanceof ApiError && e.fields) setFieldErrors(e.fields);
      setError(e as Error);
    } finally {
      setSaving(false);
    }
  }

  if (!isHr) return <p className="error">Chỉ HR được tạo và sửa hồ sơ nhân viên.</p>;
  if (current.error) return <ErrorBox error={current.error} />;
  if (mode === 'edit' && !current.data) return <p>Đang tải…</p>;

  const lookups = { departments: departments.data ?? [], positions: positions.data ?? [] };
  const groups: FieldGroup[] = ['basic', 'work', 'sensitive'];

  return (
    <section className="card">
      <h2>{mode === 'create' ? 'Tạo nhân viên' : `Sửa hồ sơ: ${current.data?.fullName}`}</h2>
      <form onSubmit={submit}>
        {groups.map((g) => (
          <fieldset key={g}>
            <legend>{GROUP_LABEL[g]}</legend>
            {g === 'sensitive' && mode === 'edit' && (
              <p className="small muted">
                {revealed ? 'Đang hiện giá trị hiện tại (đã ghi audit).' : 'Để trống là giữ nguyên giá trị đang lưu.'}{' '}
                {!revealed && (
                  <button type="button" className="link" onClick={reveal} disabled={revealing}>
                    {revealing ? 'Đang tải…' : 'Hiện giá trị hiện tại (ghi audit)'}
                  </button>
                )}
              </p>
            )}
            {fields.filter((f) => f.group === g).map((f) => (
              <FieldInput
                key={f.key}
                field={f}
                value={values[f.key] ?? ''}
                onChange={set(f.key)}
                error={fieldErrors[f.key]}
                lookups={lookups}
                suggestedManager={f.type === 'employee' ? suggested : undefined}
                selfId={id}
              />
            ))}
          </fieldset>
        ))}
        <p className="small muted">Mọi nhân viên trừ CEO phải có quản lý trực tiếp. Trường nhạy cảm được mã hóa khi lưu; audit chỉ ghi tên trường.</p>
        <div className="actions">
          <button className="primary" disabled={saving}>{saving ? 'Đang lưu…' : mode === 'create' ? 'Tạo nhân viên' : 'Lưu'}</button>
          <Link className="button" to={mode === 'create' ? '/directory' : `/employees/${id}`}>Hủy</Link>
        </div>
      </form>
      <ErrorBox error={error} />
    </section>
  );
}
