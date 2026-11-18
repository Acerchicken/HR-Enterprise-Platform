import { Briefcase, Pencil, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { api, Department, DepartmentDetail, DepartmentNode, DirectoryEntry, headLabel, Me, Page, UNIT_LABEL } from '../api/client';
import { useApi } from '../api/useApi';
import { ErrorBox } from '../components/ErrorBox';
import { useShell } from '../components/shell';
import { Avatar } from '../components/ui';
import { UnitFormDialog } from './org/UnitFormDialog';

function findNode(nodes: DepartmentNode[], id: string): DepartmentNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = findNode(n.children, id);
    if (hit) return hit;
  }
  return null;
}

function TreeNode({ node, selected, onSelect }: { node: DepartmentNode; selected?: string; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <li>
      {node.children.length > 0 ? (
        <button className="toggle" onClick={() => setOpen(!open)} aria-label={open ? 'Thu gọn' : 'Mở rộng'}>{open ? '▾' : '▸'}</button>
      ) : (
        <span className="toggle" />
      )}
      <button className={`link ${selected === node.id ? 'active' : ''}`} onClick={() => onSelect(node.id)}>
        {node.name}
      </button>
      <span className={`badge unit-${node.unitType.toLowerCase()}`}>{UNIT_LABEL[node.unitType].name}</span>
      <span className="muted small">
        {' '}· {node.head ? `${node.head.acting ? 'Quyền: ' : ''}${node.head.fullName}` : 'Chưa có trưởng'} · {node.memberCount} người
      </span>
      {open && node.children.length > 0 && (
        <ul className="tree">
          {node.children.map((c) => (
            <TreeNode key={c.id} node={c} selected={selected} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Sơ đồ tổ chức (bản vẽ uc2-org): cây bên trái; bên phải là lãnh đạo đơn vị, rồi thành viên (AC-2.9.4). */
export function OrgPage() {
  const me = useOutletContext<Me | null>();
  const canManage = !!me?.roles.some((r) => r === 'HR' || r === 'ADMIN');
  const tree = useApi(() => api<DepartmentNode[]>('/departments/tree'), []);
  const units = useApi(() => (canManage ? api<Department[]>('/departments') : Promise.resolve([] as Department[])), [canManage]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<'create' | 'edit' | null>(null);
  const { openQuickView } = useShell();
  // Thẻ "Xem sơ đồ tổ chức" ở popup hồ sơ mở /org?dept={id} tại đơn vị đó.
  const [params] = useSearchParams();
  const wanted = params.get('dept');
  useEffect(() => {
    if (wanted && tree.data && findNode(tree.data, wanted)) setSelectedId(wanted);
  }, [wanted, tree.data]);
  const detail = useApi(
    () => (selectedId ? api<DepartmentDetail>(`/departments/${selectedId}`) : Promise.resolve(null)),
    [selectedId],
  );
  const members = useApi(
    () => (selectedId ? api<Page<DirectoryEntry>>(`/departments/${selectedId}/members?size=100`) : Promise.resolve(null)),
    [selectedId],
  );
  const d = detail.data;
  const leaders = d
    ? [
        ...(d.head ? [{ id: d.head.id, name: d.head.fullName, role: headLabel(d.unitType, d.head.acting) }] : []),
        ...d.deputies.map((x) => ({ id: x.id, name: x.fullName, role: UNIT_LABEL[d.unitType].deputy ?? 'Phó' })),
      ]
    : [];
  const leaderIds = new Set(leaders.map((l) => l.id));

  function saved(id: string | null) {
    setForm(null);
    tree.reload();
    units.reload();
    if (id) {
      if (id === selectedId) {
        detail.reload();
        members.reload();
      } else setSelectedId(id);
    } else setSelectedId(null); // vừa ngừng hoạt động
  }

  return (
    <>
      <div className="page-head">
        <h1>Sơ đồ tổ chức</h1>
        {canManage && (
          <div className="actions">
            <Link className="button" to="/org/positions"><Briefcase size={16} /> Chức danh</Link>
            <button type="button" className="primary" onClick={() => setForm('create')} disabled={!units.data}>
              <Plus size={16} /> Thêm đơn vị
            </button>
          </div>
        )}
      </div>
      <div className="grid two">
        <section className="card">
          <ErrorBox error={tree.error} />
          <ul className="tree root">
            {(tree.data ?? []).map((n) => (
              <TreeNode key={n.id} node={n} selected={selectedId ?? undefined} onSelect={setSelectedId} />
            ))}
          </ul>
        </section>
        <section className="card">
          {d ? (
            <>
              <div className="unit-head">
                <div>
                  <p className="muted small crumbs">{d.path.slice(0, -1).map((p) => p.name).join(' › ')}</p>
                  <h3>
                    {d.name} <span className={`badge unit-${d.unitType.toLowerCase()}`}>{UNIT_LABEL[d.unitType].name}</span>{' '}
                    <span className="muted small">{d.code} · {d.memberCount} người</span>
                  </h3>
                </div>
                {canManage && (
                  <button type="button" onClick={() => setForm('edit')} disabled={!units.data}>
                    <Pencil size={14} /> Sửa đơn vị
                  </button>
                )}
              </div>
              <h4 className="section-label">Lãnh đạo {UNIT_LABEL[d.unitType].name.toLowerCase()}</h4>
              {leaders.length ? (
                <div className="leaders">
                  {leaders.map((l) => (
                    <button type="button" key={l.id} className="leader" onClick={() => openQuickView(l.id)}>
                      <Avatar name={l.name} size="md" />
                      <span>
                        <strong>{l.name}</strong>
                        <span className="badge">{l.role}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted">Chưa có trưởng đơn vị.</p>
              )}
              <h4 className="section-label">
                Thành viên trực tiếp ({members.data?.total ?? 0}){(members.data?.total ?? 0) > 100 ? ' · hiển thị 100 người đầu' : ''}
              </h4>
              <ul className="plain">
                {(members.data?.items ?? []).filter((m) => !leaderIds.has(m.id)).map((m) => (
                  <li key={m.id}>
                    <button type="button" className="link" onClick={() => openQuickView(m.id)}>{m.fullName}</button>
                    <span className="muted"> · {m.positionTitle}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <ErrorBox error={detail.error} />
              <p className="muted">Chọn một đơn vị để xem lãnh đạo và thành viên.</p>
            </>
          )}
        </section>
      </div>
      {form && units.data && (
        <UnitFormDialog
          unit={form === 'edit' ? d : null}
          defaultParentId={form === 'create' ? (selectedId ?? undefined) : undefined}
          units={units.data}
          onClose={() => setForm(null)}
          onSaved={saved}
        />
      )}
    </>
  );
}
