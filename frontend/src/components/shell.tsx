import { createContext, ReactNode, useContext, useState } from 'react';
import { api, Me } from '../api/client';
import { useApi } from '../api/useApi';
import { useOpenProfile } from '../profile/navigation';
import { QuickViewCard } from './QuickViewCard';

interface Shell {
  me: Me | null;
  meError: Error | null;
  /** Mở thẻ xem nhanh một đồng nghiệp (frontend.md 4.1). */
  openQuickView: (employeeId: string) => void;
}

const ShellContext = createContext<Shell>({ me: null, meError: null, openQuickView: () => {} });

export function useShell() {
  return useContext(ShellContext);
}

/** Dữ liệu dùng chung của khung ứng dụng: `GET /me` gọi một lần, thẻ xem nhanh nổi trên mọi trang. */
export function ShellProvider({ children }: { children: ReactNode }) {
  const me = useApi(() => api<Me>('/me'), []);
  const [quick, setQuick] = useState<string | null>(null);
  const openProfile = useOpenProfile();

  return (
    <ShellContext.Provider value={{ me: me.data, meError: me.error, openQuickView: setQuick }}>
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
