import { useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { api, DirectoryEntry, EmployeeProfile, Me } from '../api/client';
import { useApi } from '../api/useApi';
import { ErrorBox } from '../components/ErrorBox';

const VISIBILITY_LABEL = {
  PUBLIC: 'Bạn chỉ thấy thông tin danh bạ',
  PERSONAL: 'Bạn thấy thông tin cá nhân (chính mình hoặc nhân viên trực thuộc)',
  HR: 'Bạn là HR: thấy toàn bộ hồ sơ',
};

export function EmployeePage() {
  const { id } = useParams();
  const me = useOutletContext<Me | null>();
  const [withSensitive, setWithSensitive] = useState(false);
  const profile = useApi(
    () => api<EmployeeProfile>(`/employees/${id}${withSensitive ? '?include=sensitive' : ''}`),
    [id, withSensitive],
  );
  const reports = useApi(() => api<DirectoryEntry[]>(`/employees/${id}/direct-reports`), [id]);
  const e = profile.data;
  const isHr = me?.roles.includes('HR');

  if (profile.error) return <ErrorBox error={profile.error} />;
  if (!e) return <p>Đang tải…</p>;

  return (
    <div className="grid">
      <section className="card">
        <h2>{e.fullName}</h2>
        <p className="muted small">{VISIBILITY_LABEL[e.visibility]}</p>
        <dl>
          <dt>Mã nhân viên</dt><dd>{e.employeeCode}</dd>
          <dt>Email</dt><dd>{e.workEmail}</dd>
          <dt>Điện thoại</dt><dd>{e.phone ?? '—'}</dd>
          <dt>Phòng ban</dt><dd>{e.departmentName}</dd>
          <dt>Chức danh</dt><dd>{e.positionTitle}</dd>
          <dt>Quản lý trực tiếp</dt>
          <dd>{e.managerId ? <Link to={`/employees/${e.managerId}`}>{e.managerName}</Link> : '—'}</dd>
          {e.visibility !== 'PUBLIC' && (
            <>
              <dt>Ngày sinh</dt><dd>{e.dateOfBirth ?? '—'}</dd>
              <dt>Địa chỉ</dt><dd>{e.address ?? '—'}</dd>
              <dt>Ngày vào làm</dt><dd>{e.hireDate}</dd>
              <dt>Trạng thái</dt><dd>{e.status}</dd>
            </>
          )}
        </dl>
        {isHr && (
          <div className="sensitive">
            {e.sensitive ? (
              <dl>
                <dt>CCCD</dt><dd>{e.sensitive.nationalId}</dd>
                <dt>Số tài khoản</dt><dd>{e.sensitive.bankAccount}</dd>
                <dt>Lương tháng</dt><dd>{Number(e.sensitive.salary).toLocaleString('vi-VN')} ₫</dd>
              </dl>
            ) : (
              <button onClick={() => setWithSensitive(true)}>Xem trường nhạy cảm (sẽ ghi audit)</button>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <h3>Nhân viên trực thuộc ({reports.data?.length ?? 0})</h3>
        <ul className="plain">
          {(reports.data ?? []).map((r) => (
            <li key={r.id}><Link to={`/employees/${r.id}`}>{r.fullName}</Link> <span className="muted">· {r.positionTitle}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
