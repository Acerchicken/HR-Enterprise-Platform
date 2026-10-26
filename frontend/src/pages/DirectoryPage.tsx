import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, Department, DirectoryEntry, Page } from '../api/client';
import { useApi } from '../api/useApi';
import { ErrorBox } from '../components/ErrorBox';

const SIZE = 20;

export function DirectoryPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const dept = params.get('dept') ?? '';
  const page = Number(params.get('page') ?? 1);
  const [input, setInput] = useState(q);

  // Gõ xong 300 ms mới gọi API, tránh gửi request theo từng phím.
  useEffect(() => {
    const t = setTimeout(() => {
      if (input !== q) update({ q: input, page: '1' });
    }, 300);
    return () => clearTimeout(t);
  });

  const departments = useApi(() => api<Department[]>('/departments'), []);
  const list = useApi(() => {
    const qs = new URLSearchParams({ page: String(page), size: String(SIZE) });
    if (q) qs.set('q', q);
    if (dept) qs.set('dept', dept);
    return api<Page<DirectoryEntry>>(`/employees?${qs}`);
  }, [q, dept, page]);

  function update(next: Record<string, string>) {
    const merged = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) (v ? merged.set(k, v) : merged.delete(k));
    setParams(merged);
  }

  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / SIZE)) : 1;

  return (
    <section className="card">
      <h2>Danh bạ nhân viên</h2>
      <div className="toolbar">
        <input placeholder="Tìm theo tên, email, mã nhân viên…" value={input} onChange={(e) => setInput(e.target.value)} />
        <select value={dept} onChange={(e) => update({ dept: e.target.value, page: '1' })}>
          <option value="">Tất cả phòng ban</option>
          {(departments.data ?? []).map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>
      <ErrorBox error={list.error} />
      <table>
        <thead>
          <tr><th>Mã</th><th>Họ tên</th><th>Phòng ban</th><th>Chức danh</th><th>Email</th><th>Điện thoại</th></tr>
        </thead>
        <tbody>
          {(list.data?.items ?? []).map((e) => (
            <tr key={e.id}>
              <td>{e.employeeCode}</td>
              <td><Link to={`/employees/${e.id}`}>{e.fullName}</Link></td>
              <td>{e.departmentName}</td>
              <td>{e.positionTitle}</td>
              <td>{e.workEmail}</td>
              <td>{e.phone}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pager">
        <button disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>‹ Trước</button>
        <span>Trang {page}/{totalPages} · {list.data?.total ?? 0} người</span>
        <button disabled={page >= totalPages} onClick={() => update({ page: String(page + 1) })}>Sau ›</button>
      </div>
    </section>
  );
}
