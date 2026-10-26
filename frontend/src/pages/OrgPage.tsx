import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, DepartmentNode, DirectoryEntry, Page } from '../api/client';
import { useApi } from '../api/useApi';
import { ErrorBox } from '../components/ErrorBox';

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
      <span className="muted small"> · {node.office}</span>
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
            <h3>{dept.name} <span className="muted small">({dept.code})</span></h3>
            <p className="muted small">{members.data?.total ?? 0} thành viên{(members.data?.total ?? 0) > 100 ? ' · hiển thị 100 người đầu' : ''}</p>
            <ul className="plain">
              {(members.data?.items ?? []).map((m) => (
                <li key={m.id}>
                  <Link to={`/employees/${m.id}`}>{m.fullName}</Link>
                  <span className="muted"> · {m.positionTitle}</span>
                  {m.id === dept.headEmployeeId && <span className="badge">Trưởng đơn vị</span>}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted">Chọn một phòng ban để xem thành viên.</p>
        )}
      </section>
    </div>
  );
}
