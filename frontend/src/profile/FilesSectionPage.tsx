import { useState } from 'react';
import { api, ProfileSummary, RowSection } from '../api/client';
import { invalidateSummary } from '../api/cache';
import { useApi } from '../api/useApi';
import { FileList, FileUpload, FileView } from '../components/files';
import { errorText, Skeleton } from '../components/ui';
import { newKey, RequestBox } from './fields';

/**
 * Mục chỉ gồm file (Sơ yếu lý lịch). Chủ hồ sơ tải lên rồi gửi yêu cầu, HR duyệt mới dùng; muốn xóa thì gửi yêu cầu xóa. HR tải
 * lên, xóa trực tiếp (A8). Bản mới nhất hiện đầu.
 */
export function FilesSectionPage({ s, code }: { s: ProfileSummary; code: string }) {
  const data = useApi<RowSection>(() => api(`/employees/${s.id}/profile/${code}`), [s.id, code]);
  const [error, setError] = useState<Error | null>(null);
  const d = data.data;

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      invalidateSummary(s.id);
      data.reload();
    } catch (e) {
      setError(e as Error);
    }
  }

  const propose = (action: 'CREATE' | 'DELETE', files: FileView[]) =>
    run(() =>
      api(`/employees/${s.id}/change-requests`, {
        method: 'POST',
        headers: { 'Idempotency-Key': newKey() },
        body: JSON.stringify({ section: code, action, fileIds: files.map((f) => f.id) }),
      }),
    );

  if (data.error) return <p className="error pad">{errorText(data.error)}</p>;
  if (!d) return <div className="pad"><Skeleton lines={3} /></div>;
  const files = (d.files ?? []).filter((f) => f.status !== 'PENDING_REVIEW');
  const pendingDeletes = new Set(d.requests.filter((r) => r.action === 'DELETE' && r.status === 'PENDING').flatMap((r) => r.fileIds));

  return (
    <>
      {d.notice && <p className="pad small muted">{d.notice}</p>}
      <div className="fld">
        {files.length === 0 && <p className="muted">Chưa có file nào.</p>}
        <FileList
          employeeId={s.id}
          files={files}
          onRemove={
            d.canPropose
              ? (f) => !pendingDeletes.has(f.id) && !f.uploadedByHr && confirm('Gửi yêu cầu xóa file này?') && void propose('DELETE', [f])
              : d.canEdit
                ? (f) => confirm('Xóa file này? HR vẫn tải được trong 30 ngày.') && void run(() => api(`/employees/${s.id}/files/${f.id}`, { method: 'DELETE' }))
                : undefined
          }
        />
        {d.requests.map((r) => (
          <RequestBox
            key={r.id}
            req={r}
            fields={[]}
            onCancel={() => void run(() => api(`/employees/${s.id}/change-requests/${r.id}`, { method: 'DELETE' }))}
            onDismiss={() => void run(() => api(`/employees/${s.id}/change-requests/${r.id}/acknowledge`, { method: 'POST' }))}
          />
        ))}
      </div>
      {(d.canPropose || d.canEdit) && (
        <div className="pad">
          <FileUpload
            employeeId={s.id}
            section={code}
            label={d.canPropose ? 'Tải lên và gửi yêu cầu' : 'Tải lên'}
            onUploaded={(f) => (f.status === 'PENDING_REVIEW' ? void propose('CREATE', [f]) : data.reload())}
          />
          {d.canPropose && <p className="small muted">File chỉ dùng sau khi HR xác nhận.</p>}
        </div>
      )}
      {error && <p className="error pad">{errorText(error)}</p>}
    </>
  );
}
