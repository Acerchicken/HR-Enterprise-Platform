import { Download } from 'lucide-react';
import { useState } from 'react';
import { DocVersion, fileKind } from '../../api/documents';
import { formatSize } from '../../api/transfer';

/** Ô "PDF" / "DOCX" đầu dòng tài liệu (bản vẽ uc56-documents). */
export function FileBadge({ version }: { version: DocVersion | null }) {
  const kind = fileKind(version);
  if (!kind) return <span className="doc-kind" aria-hidden="true">—</span>;
  return <span className={`doc-kind ${kind.toLowerCase()}`} aria-hidden="true">{kind}</span>;
}

/**
 * Nút tải một phiên bản qua API (DR-06). Lỗi hiện ngay cạnh nút; 404 nói chung "không tìm thấy hoặc không có quyền" (DR-08).
 */
export function DownloadButton({
  download,
  label,
  text,
  primary = false,
}: {
  download: () => Promise<void>;
  label: string;
  /** Có chữ thì là nút to ("Tải bản mới nhất (1,2 MiB)"), không có thì là nút biểu tượng. */
  text?: string;
  primary?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await download();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="download">
      <button type="button" className={text ? (primary ? 'primary' : '') : 'icon-btn'} aria-label={label} disabled={busy} onClick={run}>
        <Download size={16} />
        {text && ` ${busy ? 'Đang tải…' : text}`}
      </button>
      {error && <span className="error small">{error}</span>}
    </span>
  );
}

export const sizeOf = (v: DocVersion) => formatSize(v.sizeBytes);
