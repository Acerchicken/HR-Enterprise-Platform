import { Search, X } from 'lucide-react';
import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, DirectoryEntry, Page } from '../api/client';
import { Avatar, errorText } from './ui';

/**
 * Ô tìm đồng nghiệp trên nav bar (frontend.md 2.1, UC6 FR-6.1): chỉ tìm đồng nghiệp, không tìm tài liệu.
 * Gõ từ 2 ký tự, chờ 300 ms sau phím cuối mới gọi API. `/` hoặc Ctrl+K để vào ô. Enter mở Danh bạ với từ khóa.
 */
export function SearchBox({ onPick }: { onPick: (id: string) => void }) {
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [items, setItems] = useState<DirectoryEntry[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        setMobileOpen(true);
        input.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setItems([]);
      setError(null);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      api<Page<DirectoryEntry>>(`/employees?${new URLSearchParams({ q: term, size: '5' })}`)
        .then((p) => live && (setItems(p.items), setError(null), setActive(-1)))
        .catch((e) => live && (setItems([]), setError(e)));
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);

  function close() {
    setOpen(false);
    setMobileOpen(false);
  }

  function pick(e: DirectoryEntry) {
    close();
    setQ('');
    onPick(e.id);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === 'Escape') {
      close();
      input.current?.blur();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && active >= 0 && items[active]) return pick(items[active]);
      if (q.trim()) {
        close();
        navigate(`/directory?${new URLSearchParams({ q: q.trim() })}`);
      }
    }
  }

  const showList = open && q.trim().length >= 2;
  return (
    <div className={`searchbox ${mobileOpen ? 'mobile-open' : ''}`}>
      <button type="button" className="icon-btn search-toggle" aria-label="Tìm đồng nghiệp" onClick={() => {
        setMobileOpen(true);
        setTimeout(() => input.current?.focus());
      }}>
        <Search size={20} />
      </button>
      <div className="search-field">
        <Search size={18} aria-hidden="true" />
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls="search-results"
          aria-label="Tìm đồng nghiệp"
          placeholder="Tìm đồng nghiệp…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
        />
        <span className="kbd">Ctrl K</span>
        <button type="button" className="icon-btn search-close" aria-label="Đóng tìm kiếm" onClick={close}>
          <X size={20} />
        </button>
      </div>
      {showList && (
        <div className="search-dd" id="search-results" role="listbox">
          <h4>Đồng nghiệp</h4>
          {error && <p className="error small pad">{errorText(error)}</p>}
          {!error && items.length === 0 && <p className="muted small pad">Không tìm thấy đồng nghiệp nào.</p>}
          {items.map((e, i) => (
            <button
              type="button"
              key={e.id}
              role="option"
              aria-selected={i === active}
              className={`search-row ${i === active ? 'sel' : ''}`}
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => pick(e)}
            >
              <Avatar name={e.fullName} />
              <span>
                {e.fullName}
                <small>
                  {e.employeeCode} · {e.positionTitle ?? '—'} · {e.departmentName ?? '—'}
                </small>
              </span>
            </button>
          ))}
          <button
            type="button"
            className="search-foot"
            onMouseDown={(ev) => ev.preventDefault()}
            onClick={() => {
              close();
              navigate(`/directory?${new URLSearchParams({ q: q.trim() })}`);
            }}
          >
            Xem tất cả trong Danh bạ cho "{q.trim()}" (Enter)
          </button>
        </div>
      )}
    </div>
  );
}
