import { Pencil, Plus } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api, Me, Position } from '../../api/client';
import { useApi } from '../../api/useApi';
import { ErrorBox } from '../../components/ErrorBox';

const LEVELS = Array.from({ length: 10 }, (_, i) => i + 1);

/**
 * Danh mục chức danh và cấp bậc (bản vẽ uc2-positions, FR-2.6). HR thêm, sửa tên, cấp bậc ngay trên dòng và ngừng dùng;
 * người khác chỉ xem. Không xóa hẳn chức danh (AC-2.6.2).
 */
export function PositionsPage() {
  const me = useOutletContext<Me | null>();
  const isHr = !!me?.roles.includes('HR');
  const list = useApi(() => api<Position[]>('/positions'), []);
  const [tab, setTab] = useState<'active' | 'inactive'>('active');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<{ id: string; title: string; level: number } | null>(null);
  const [adding, setAdding] = useState<{ code: string; title: string; level: number } | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const all = list.data ?? [];
  const term = q.trim().toLowerCase();
  const rows = all
    .filter((p) => (tab === 'active' ? p.active : !p.active))
    .filter((p) => !term || `${p.code} ${p.title}`.toLowerCase().includes(term));

  async function patch(id: string, body: object) {
    setError(null);
    try {
      await api(`/positions/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setEditing(null);
      list.reload();
    } catch (e) {
      setError(e as Error);
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!adding) return;
    setError(null);
    try {
      await api('/positions', { method: 'POST', body: JSON.stringify({ ...adding, code: adding.code.trim().toUpperCase() }) });
      setAdding(null);
      setTab('active');
      list.reload();
    } catch (err) {
      setError(err as Error);
    }
  }

  return (
    <>
      <p className="muted small crumbs"><Link to="/org">Sơ đồ tổ chức</Link> › Chức danh</p>
      <div className="page-head">
        <h1>Chức danh và cấp bậc</h1>
        {isHr && (
          <button type="button" className="primary" onClick={() => setAdding({ code: '', title: '', level: 3 })}>
            <Plus size={16} /> Thêm chức danh
          </button>
        )}
      </div>
      <div className="toolbar">
        <input placeholder="Tìm mã, tên chức danh…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm chức danh" />
        <div className="segmented">
          <button type="button" className={tab === 'active' ? 'primary' : ''} onClick={() => setTab('active')}>
            Đang dùng ({all.filter((p) => p.active).length})
          </button>
          <button type="button" className={tab === 'inactive' ? 'primary' : ''} onClick={() => setTab('inactive')}>
            Ngừng dùng ({all.filter((p) => !p.active).length})
          </button>
        </div>
      </div>
      <ErrorBox error={list.error ?? error} />
      <section className="card flush">
        <table>
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên chức danh</th>
              <th>Cấp bậc</th>
              <th>Số người đang giữ</th>
              <th>Đang dùng</th>
              {isHr && <th aria-label="Thao tác" />}
            </tr>
          </thead>
          <tbody>
            {adding && (
              <tr className="editing">
                <td>
                  <input aria-label="Mã" value={adding.code} onChange={(e) => setAdding({ ...adding, code: e.target.value.toUpperCase() })} />
                </td>
                <td>
                  <input aria-label="Tên chức danh" value={adding.title} onChange={(e) => setAdding({ ...adding, title: e.target.value })} />
                </td>
                <td>
                  <select aria-label="Cấp bậc" value={adding.level} onChange={(e) => setAdding({ ...adding, level: Number(e.target.value) })}>
                    {LEVELS.map((l) => <option key={l}>{l}</option>)}
                  </select>
                </td>
                <td>0</td>
                <td />
                <td>
                  <form onSubmit={create} className="row-actions">
                    <button type="submit" className="primary">Lưu</button>
                    <button type="button" onClick={() => setAdding(null)}>Hủy</button>
                  </form>
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const row = editing?.id === p.id ? editing : null;
              return (
                <tr key={p.id} className={row ? 'editing' : ''}>
                  <td><code>{p.code}</code>{p.system && <span className="badge">Hệ thống</span>}</td>
                  <td>
                    {row ? (
                      <input aria-label="Tên chức danh" value={row.title} onChange={(e) => setEditing({ ...row, title: e.target.value })} />
                    ) : (
                      p.title
                    )}
                  </td>
                  <td>
                    {row && !p.system ? (
                      <select aria-label="Cấp bậc" value={row.level} onChange={(e) => setEditing({ ...row, level: Number(e.target.value) })}>
                        {LEVELS.map((l) => <option key={l}>{l}</option>)}
                      </select>
                    ) : (
                      p.level
                    )}
                  </td>
                  <td>{p.holderCount}</td>
                  <td>
                    <input
                      type="checkbox"
                      className="switch"
                      role="switch"
                      aria-label={`${p.title} đang dùng`}
                      checked={p.active}
                      disabled={!isHr || p.system}
                      title={p.system ? 'Chức danh hệ thống không ngừng dùng được' : undefined}
                      onChange={(e) => patch(p.id, { active: e.target.checked })}
                    />
                  </td>
                  {isHr && (
                    <td>
                      {row ? (
                        <div className="row-actions">
                          <button type="button" className="primary" onClick={() => patch(p.id, p.system ? { title: row.title } : { title: row.title, level: row.level })}>
                            Lưu
                          </button>
                          <button type="button" onClick={() => setEditing(null)}>Hủy</button>
                        </div>
                      ) : (
                        <button type="button" className="icon-btn" aria-label={`Sửa ${p.title}`} onClick={() => setEditing({ id: p.id, title: p.title, level: p.level })}>
                          <Pencil size={16} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
