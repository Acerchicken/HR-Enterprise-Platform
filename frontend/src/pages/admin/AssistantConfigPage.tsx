import { CircleCheck, CircleX, Sparkles } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useOutletContext } from 'react-router-dom';
import { ApiError, Me } from '../../api/client';
import { AssistantConfig, assistantConfigApi, AssistantModel, ConnectionTest } from '../../api/assistant';
import { useApi } from '../../api/useApi';
import { ErrorBox } from '../../components/ErrorBox';
import { Skeleton } from '../../components/ui';

const WHEN = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * Trang "Cấu hình trợ lý" (bản vẽ uc6-config; UC6 FR-6.4, spec 4.2). Chỉ ADMIN chọn nhà cung cấp AI, dán API key, chọn model,
 * kiểm tra kết nối, bật/tắt trợ lý. Khóa đã lưu không bao giờ hiện lại, chỉ 4 ký tự cuối (AC-6.4.4); đổi sang nhà cung cấp khác
 * thì bắt nhập khóa mới (AC-6.4.5). Danh sách nhà cung cấp lấy từ API, thêm nhà cung cấp không phải sửa trang này.
 */
export function AssistantConfigPage() {
  const me = useOutletContext<Me | null>();
  const isAdmin = !!me?.roles.includes('ADMIN');
  const cfg = useApi(() => (isAdmin ? assistantConfigApi.get() : Promise.resolve(null)), [isAdmin]);

  if (me && !isAdmin) return <Navigate to="/" replace />;
  return (
    <>
      <p className="muted small crumbs"><Link to="/">Trang chủ</Link> › Quản trị › Cấu hình trợ lý</p>
      <div className="page-head">
        <h1><Sparkles size={22} aria-hidden /> Cấu hình trợ lý</h1>
      </div>
      <ErrorBox error={cfg.error} />
      {!cfg.data ? !cfg.error && <Skeleton lines={6} /> : <ConfigForm key={cfg.data.version} initial={cfg.data} onSaved={cfg.reload} />}
    </>
  );
}

function ConfigForm({ initial, onSaved }: { initial: AssistantConfig; onSaved: () => void }) {
  const [enabled, setEnabled] = useState(initial.provider ? initial.enabled : true);
  const [provider, setProvider] = useState(initial.provider ?? initial.providers[0]?.id ?? '');
  const [model, setModel] = useState(initial.model ?? '');
  const [apiKey, setApiKey] = useState('');
  /** Đang dùng khóa đã lưu (ô khóa hiện ••••abcd). Đổi nhà cung cấp hoặc bấm "Thay khóa" thì phải nhập khóa mới. */
  const [keepKey, setKeepKey] = useState(!!initial.apiKeyLast4);
  const [models, setModels] = useState<AssistantModel[]>(initial.model ? [{ id: initial.model, name: initial.model }] : []);
  const [test, setTest] = useState<ConnectionTest | null>(null);
  const [busy, setBusy] = useState<'models' | 'test' | 'save' | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [saved, setSaved] = useState(false);
  const fields = error instanceof ApiError ? (error.fields ?? {}) : {};

  const sameProvider = provider === initial.provider;
  const usingStoredKey = keepKey && sameProvider;
  const key = usingStoredKey ? undefined : apiKey.trim() || undefined;
  const hasKey = usingStoredKey || !!key;
  const region = initial.providers.find((p) => p.id === provider)?.dataRegion;

  // Thông báo cũ không còn đúng khi đổi nhà cung cấp, khóa hoặc model.
  useEffect(() => {
    setTest(null);
    setSaved(false);
  }, [provider, apiKey, model, keepKey]);

  function pickProvider(id: string) {
    if (id === provider) return;
    setProvider(id);
    setApiKey('');
    setKeepKey(id === initial.provider && !!initial.apiKeyLast4);
    const back = id === initial.provider && initial.model;
    setModel(back ? initial.model! : '');
    setModels(back ? [{ id: initial.model!, name: initial.model! }] : []);
    setError(null);
  }

  async function run<T>(what: 'models' | 'test' | 'save', fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(what);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(err as Error);
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  async function loadModels() {
    const r = await run('models', () => assistantConfigApi.models(provider, key));
    if (!r) return;
    setModels(r.models);
    if (!r.models.some((m) => m.id === model)) setModel(r.models[0]?.id ?? '');
  }

  async function testConnection() {
    const r = await run('test', () => assistantConfigApi.test(provider, model, key));
    if (r) setTest(r);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const r = await run('save', () => assistantConfigApi.save({ provider, model, apiKey: key, enabled, version: initial.version }));
    if (r) {
      setSaved(true);
      onSaved();
    }
  }

  return (
    <form className="card config-card" onSubmit={save}>
      <label className="switch-row">
        <input type="checkbox" role="switch" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <strong>Bật trợ lý cho nhân viên</strong>
        <span className="muted small">(tắt thì nhân viên chỉ nhận danh sách tài liệu liên quan)</span>
      </label>

      <span className="muted small">Nhà cung cấp *</span>
      <div className="segmented provider-pick" role="radiogroup" aria-label="Nhà cung cấp">
        {initial.providers.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={provider === p.id} className={provider === p.id ? 'primary' : ''} onClick={() => pickProvider(p.id)}>
            {p.name}
          </button>
        ))}
      </div>
      {region && <p className="muted small">Câu hỏi và đoạn tài liệu được gửi tới máy chủ của nhà cung cấp tại {region}.</p>}
      {fields.provider && <span className="field-error">{fields.provider}</span>}

      <label>
        API key *
        {usingStoredKey ? (
          <div className="key-row">
            <input value={`••••••••••••••••${initial.apiKeyLast4}`} readOnly aria-label="API key đã lưu" />
            <button type="button" className="link" onClick={() => setKeepKey(false)}>Thay khóa</button>
          </div>
        ) : (
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={sameProvider || !initial.provider ? 'Dán API key' : 'Đổi nhà cung cấp phải nhập API key mới'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        )}
        {fields.apiKey && <span className="field-error">{fields.apiKey}</span>}
      </label>

      <label>
        Model *
        <div className="key-row">
          <select value={model} onChange={(e) => setModel(e.target.value)} disabled={!models.length}>
            {!models.length && <option value="">Bấm "Tải danh sách model"</option>}
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.name === m.id ? m.id : `${m.name} (${m.id})`}</option>
            ))}
          </select>
          <button type="button" onClick={loadModels} disabled={!provider || !hasKey || busy !== null}>
            {busy === 'models' ? 'Đang tải…' : 'Tải danh sách model'}
          </button>
        </div>
        {fields.model && <span className="field-error">{fields.model}</span>}
      </label>

      {test && (
        <p className={`note ${test.ok ? 'ok-note' : 'warn'}`} role="status">
          {test.ok ? <CircleCheck size={16} aria-hidden /> : <CircleX size={16} aria-hidden />}{' '}
          {test.ok ? `Kết nối thành công · ${test.latencyMs} ms · ${model}` : `Không kết nối được: ${test.error?.message ?? 'lỗi không rõ'}`}
        </p>
      )}
      {saved && <p className="note ok-note" role="status"><CircleCheck size={16} aria-hidden /> Đã lưu. Câu hỏi kế tiếp của nhân viên dùng cấu hình mới.</p>}
      <ErrorBox error={error && !fields.apiKey && !fields.model && !fields.provider ? error : null} />

      <div className="row-between config-foot">
        <div className="row-actions">
          <button type="button" onClick={testConnection} disabled={!model || !hasKey || busy !== null}>
            {busy === 'test' ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}
          </button>
          <button type="submit" className="primary" disabled={!model || !hasKey || busy !== null}>
            {busy === 'save' ? 'Đang lưu…' : 'Lưu'}
          </button>
        </div>
        {initial.updatedAt && (
          <span className="muted small">
            Sửa lần cuối: {initial.updatedByName ?? 'không rõ'} · {WHEN.format(new Date(initial.updatedAt))}
          </span>
        )}
      </div>
    </form>
  );
}
