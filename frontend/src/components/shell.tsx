import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, Me, TodoCounts } from '../api/client';
import { useApi } from '../api/useApi';
import { useOpenProfile } from '../profile/navigation';
import { QuickViewCard } from './QuickViewCard';

interface Shell {
  me: Me | null;
  meError: Error | null;
  /** Mở thẻ xem nhanh một đồng nghiệp (frontend.md 4.1). */
  openQuickView: (employeeId: string) => void;
  /** Số việc chờ cho chuông, trang chủ, tab trang "Việc cần duyệt" (AC-0.2.2, AC-0.6.1); null khi chưa tải hoặc lỗi. */
  todo: TodoCounts | null;
  /** Đã có phản hồi đầu tiên của `todo-counts` (thành công hoặc lỗi). */
  todoReady: boolean;
}

const ShellContext = createContext<Shell>({ me: null, meError: null, openQuickView: () => {}, todo: null, todoReady: false });

export function useShell() {
  return useContext(ShellContext);
}

/**
 * Dữ liệu dùng chung của khung ứng dụng: `GET /me` gọi một lần, thẻ xem nhanh nổi trên mọi trang. Số việc chờ
 * (`GET /me/todo-counts`) tải lại mỗi khi đổi trang: duyệt xong một việc thì trang duyệt chuyển URL nên số cập nhật theo.
 */
export function ShellProvider({ children }: { children: ReactNode }) {
  const me = useApi(() => api<Me>('/me'), []);
  const [quick, setQuick] = useState<string | null>(null);
  const [todo, setTodo] = useState<TodoCounts | null>(null);
  const [todoReady, setTodoReady] = useState(false);
  const openProfile = useOpenProfile();
  const { pathname, search } = useLocation();
  const signedIn = !!me.data;

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    api<TodoCounts>('/me/todo-counts')
      .then((t) => live && setTodo(t))
      .catch(() => live && setTodo(null))
      .finally(() => live && setTodoReady(true));
    return () => {
      live = false;
    };
  }, [signedIn, pathname, search]);

  return (
    <ShellContext.Provider value={{ me: me.data, meError: me.error, openQuickView: setQuick, todo, todoReady }}>
      {children}
      {quick && (
        <QuickViewCard
          id={quick}
          onClose={() => setQuick(null)}
          onFull={(id) => {
            setQuick(null);
            openProfile(id);
          }}
        />
      )}
    </ShellContext.Provider>
  );
}
