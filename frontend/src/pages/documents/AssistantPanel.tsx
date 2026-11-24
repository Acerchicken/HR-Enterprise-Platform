import { FileText, SendHorizontal, Sparkles } from 'lucide-react';
import { FormEvent, Fragment, ReactNode, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { AssistantAnswer, assistantApi } from '../../api/assistant';
import { useCooldown } from '../../components/ui';

const MAX = 500;

interface Turn {
  id: number;
  question: string;
  answer?: AssistantAnswer;
  error?: string;
}

/** `[n]` trong câu trả lời thành số trích dẫn nhỏ; giữ chữ thường là text node (không render HTML từ AI). */
function withMarks(text: string, valid: Set<number>): ReactNode[] {
  return text.split(/(\[\d{1,3}\])/g).map((part, i) => {
    const m = /^\[(\d{1,3})\]$/.exec(part);
    if (m && valid.has(Number(m[1]))) return <sup key={i} className="cite-mark">{m[1]}</sup>;
    return <Fragment key={i}>{part.replace(/\*\*/g, '')}</Fragment>;
  });
}

/** Dòng bắt đầu bằng "-", "*", "•" thành danh sách; còn lại là đoạn văn. */
function AnswerText({ text, valid }: { text: string; valid: Set<number> }) {
  const blocks: ReactNode[] = [];
  let items: string[] = [];
  const flush = () => {
    if (items.length) blocks.push(<ul key={blocks.length}>{items.map((t, i) => <li key={i}>{withMarks(t, valid)}</li>)}</ul>);
    items = [];
  };
  for (const line of text.split('\n')) {
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (bullet) items.push(bullet[1]);
    else {
      flush();
      if (line.trim()) blocks.push(<p key={blocks.length}>{withMarks(line, valid)}</p>);
    }
  }
  flush();
  return <>{blocks}</>;
}

function AnswerCard({ a }: { a: AssistantAnswer }) {
  const valid = new Set(a.citations.map((c) => c.n));
  return (
    <div className="assistant-answer">
      {a.masked && <p className="note">Đã ẩn thông tin cá nhân (số điện thoại, email, số giấy tờ) trước khi gửi.</p>}
      <AnswerText text={a.answer} valid={valid} />
      {a.citations.length > 0 && (
        <ol className="plain cite-list">
          {a.citations.map((c) => (
            <li key={c.n} title={c.citedText}>
              <span className="cite-n">{c.n}</span>
              <FileText size={15} aria-hidden />
              <span className="cite-title">{c.title} · v{c.versionNo}{c.section && ` · ${c.section}`}</span>
              <Link to={`/documents/${c.documentId}`}>Mở</Link>
            </li>
          ))}
        </ol>
      )}
      {a.fallback && (a.documents?.length ?? 0) > 0 && (
        <ul className="plain cite-list">
          {a.documents!.map((d) => (
            <li key={d.documentId}>
              <FileText size={15} aria-hidden />
              <span className="cite-title">{d.title}</span>
              <Link to={`/documents/${d.documentId}`}>Mở</Link>
            </li>
          ))}
        </ul>
      )}
      {a.citations.length > 0 && (
        <p className="muted small">Câu trả lời do AI tạo từ tài liệu bạn được xem, chỉ để tham khảo; căn cứ là văn bản gốc. Có thắc mắc thì liên hệ HR.</p>
      )}
    </div>
  );
}

/**
 * Khung "Hỏi trợ lý chính sách" trên `/documents` (UC6 spec 4.1, 9.1). Mỗi câu hỏi độc lập (A4); lịch sử chỉ giữ trong
 * trang đang mở, không lưu localStorage. Sau 429 khóa nút gửi tới hết `Retry-After` (AC-6.3.6).
 */
export function AssistantPanel() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [rateError, setRateError] = useState<Error | null>(null);
  const cooldown = useCooldown(rateError);
  const endRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => endRef.current?.scrollIntoView?.({ block: 'nearest' }), [turns]);

  const question = text.trim();
  const canSend = !busy && cooldown === 0 && question.length > 0 && question.length <= MAX;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    const id = nextId.current++;
    setTurns((t) => [...t, { id, question }]);
    setText('');
    setBusy(true);
    try {
      const answer = await assistantApi.ask(question);
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, answer } : x)));
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) setRateError(err);
      const msg = err instanceof Error ? err.message : 'Không gửi được câu hỏi';
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, error: msg } : x)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card assistant" aria-label="Hỏi trợ lý chính sách">
      <div className="assistant-head">
        <h2><Sparkles size={18} aria-hidden /> Hỏi trợ lý chính sách</h2>
        {turns.length > 0 && <button type="button" className="link" onClick={() => setTurns([])}>Cuộc hỏi mới</button>}
      </div>
      <div className="assistant-log" aria-live="polite">
        {turns.length === 0 && (
          <p className="muted small">Hỏi về quy định trong các tài liệu bạn được xem, ví dụ "Nghỉ cưới được mấy ngày?". Trợ lý trả lời kèm nguồn trích dẫn.</p>
        )}
        {turns.map((t) => (
          <Fragment key={t.id}>
            <p className="assistant-q">{t.question}</p>
            {t.answer && <AnswerCard a={t.answer} />}
            {t.error && <p className="error">{t.error}</p>}
            {!t.answer && !t.error && <p className="assistant-wait" aria-label="Đang trả lời"><span /><span /><span /></p>}
          </Fragment>
        ))}
        <div ref={endRef} />
      </div>
      <form className="assistant-form" onSubmit={submit}>
        <textarea
          aria-label="Câu hỏi"
          rows={2}
          maxLength={MAX}
          placeholder="Nhập câu hỏi (không nhập thông tin cá nhân)…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) submit(e as unknown as FormEvent);
          }}
        />
        <button type="submit" className="primary" disabled={!canSend} aria-label="Gửi câu hỏi">
          <SendHorizontal size={16} />
        </button>
      </form>
      <p className="muted small assistant-meta">
        {cooldown > 0 ? `Bạn đã hỏi quá nhiều, thử lại sau ${cooldown} giây.` : `${question.length}/${MAX}`}
      </p>
    </section>
  );
}
