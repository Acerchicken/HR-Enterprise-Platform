import { FormEvent, useEffect, useState } from 'react';
import { api, LeaveBalance, Me } from '../api/client';
import { useApi } from '../api/useApi';
import { ErrorBox } from '../components/ErrorBox';

export function ProfilePage() {
  const me = useApi(() => api<Me>('/me'), []);
  const balances = useApi(() => api<LeaveBalance[]>('/leave-balances/me').catch(() => []), []);
  const e = me.data?.employee;

  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPhone(e?.phone ?? '');
    setAddress(e?.address ?? '');
  }, [e?.phone, e?.address]);

  async function save(ev: FormEvent) {
    ev.preventDefault();
    if (!e) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await api<Me['employee']>(`/employees/${e.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ phone, address, version: e.version }),
      });
      me.setData({ ...me.data!, employee: updated });
      setSaved(true);
    } catch (err) {
      setSaveError(err as Error);
    } finally {
      setSaving(false);
    }
  }

  if (me.loading) return <p>Đang tải…</p>;
  if (me.error) return <ErrorBox error={me.error} />;
  if (!e) return <p>Tài khoản {me.data?.email} chưa gắn với hồ sơ nhân viên nào. Liên hệ HR.</p>;

  return (
    <div className="grid">
      <section className="card">
        <h2>{e.fullName}</h2>
        <dl>
          <dt>Mã nhân viên</dt><dd>{e.employeeCode}</dd>
          <dt>Email</dt><dd>{e.workEmail}</dd>
          <dt>Phòng ban</dt><dd>{e.departmentName}</dd>
          <dt>Chức danh</dt><dd>{e.positionTitle}</dd>
          <dt>Quản lý trực tiếp</dt><dd>{e.managerName ?? '—'}</dd>
          <dt>Ngày sinh</dt><dd>{e.dateOfBirth ?? '—'}</dd>
          <dt>Ngày vào làm</dt><dd>{e.hireDate}</dd>
          <dt>Trạng thái</dt><dd>{e.status}</dd>
        </dl>
      </section>

      <section className="card">
        <h3>Cập nhật thông tin liên hệ</h3>
        <form onSubmit={save}>
          <label>Số điện thoại<input value={phone} onChange={(x) => setPhone(x.target.value)} /></label>
          <label>Địa chỉ<input value={address} onChange={(x) => setAddress(x.target.value)} /></label>
          <button className="primary" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu'}</button>
          {saved && <span className="ok"> Đã lưu</span>}
        </form>
        <ErrorBox error={saveError} />
        <p className="muted small">Các trường khác do HR cập nhật.</p>
      </section>

      <section className="card">
        <h3>Số dư phép {new Date().getFullYear()}</h3>
        <table>
          <thead><tr><th>Loại</th><th>Được hưởng</th><th>Đã dùng</th><th>Chờ duyệt</th><th>Còn lại</th></tr></thead>
          <tbody>
            {(balances.data ?? []).map((b) => (
              <tr key={b.leaveType}>
                <td>{b.leaveTypeName}</td><td>{b.entitled}</td><td>{b.used}</td><td>{b.pending}</td><td><strong>{b.available}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">Tạo đơn nghỉ phép: tuần 8.</p>
      </section>
    </div>
  );
}
