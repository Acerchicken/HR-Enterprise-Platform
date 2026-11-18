import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, DepartmentNode, DirectoryEntry, Page, UNIT_LABEL } from '../api/client';
import { useApi } from '../api/useApi';
import { ErrorBox } from '../components/ErrorBox';
import { useShell } from '../components/shell';

function findNode(nodes: DepartmentNode[], id: string): DepartmentNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = findNode(n.children, id);
    if (hit) return hit;
  }
  return null;
}

function TreeNode({ node, selected, onSelect }: { node: DepartmentNode; selected?: string; onSelect: (n: DepartmentNode) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <li>
      {node.children.length > 0 ? (
        <button className="toggle" onClick={() => setOpen(!open)}>{open ? '▾' : '▸'}</button>
      ) : (
        <span className="toggle" />
      )}
      <button className={`link ${selected === node.id ? 'active' : ''}`} onClick={() => onSelect(node)}>
        {node.name}
      </button>
      <span className={`badge unit-${node.unitType.toLowerCase()}`}>{UNIT_LABEL[node.unitType].name}</span>
      <span className="muted small">
        {' '}· {node.head ? node.head.fullName : 'Chưa có trưởng'} · {node.memberCount} người
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

export function OrgPage() {
  const tree = useApi(() => api<DepartmentNode[]>('/departments/tree'), []);
  const [dept, setDept] = useState<DepartmentNode | null>(null);
  const { openQuickView } = useShell();
  // Thẻ "Xem sơ đồ tổ chức" ở popup hồ sơ mở /org?dept={id} tại đơn vị đó.
  const [params] = useSearchParams();
  const wanted = params.get('dept');
  useEffect(() => {
    if (wanted && tree.data) setDept(findNode(tree.data, wanted));
  }, [wanted, tree.data]);
  const members = useApi(
    () => (dept ? api<Page<DirectoryEntry>>(`/departments/${dept.id}/members?size=100`) : Promise.resolve(null)),
    [dept?.id],
  );

  return (
    <div className="grid two">
      <section className="card">
        <h2>Sơ đồ tổ chức</h2>
        <ErrorBox error={tree.error} />
        <ul className="tree root">
          {(tree.data ?? []).map((n) => (
            <TreeNode key={n.id} node={n} selected={dept?.id} onSelect={setDept} />
          ))}
        </ul>
      </section>
      <section className="card">
        {dept ? (
          <>
            <h3>
              {dept.name} <span className="badge">{UNIT_LABEL[dept.unitType].name}</span>{' '}
              <span className="muted small">({dept.code})</span>
            </h3>
            <p>
              {UNIT_LABEL[dept.unitType].head}:{' '}
              {dept.head ? (
                <button type="button" className="link" onClick={() => openQuickView(dept.head!.id)}>{dept.head.fullName}</button>
              ) : (
                <span className="muted">chưa có</span>
              )}
            </p>
            <p className="muted small">{members.data?.total ?? 0} thành viên{(members.data?.total ?? 0) > 100 ? ' · hiển thị 100 người đầu' : ''}</p>
            <ul className="plain">
              {(members.data?.items ?? []).map((m) => (
                <li key={m.id}>
                  <button type="button" className="link" onClick={() => openQuickView(m.id)}>{m.fullName}</button>
                  <span className="muted"> · {m.positionTitle}</span>
                  {m.id === dept.headEmployeeId && <span className="badge">{UNIT_LABEL[dept.unitType].head}</span>}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted">Chọn một đơn vị để xem thành viên.</p>
        )}
      </section>
    </div>
  );
}
