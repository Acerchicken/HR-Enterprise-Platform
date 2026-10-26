import { User, UserManager, WebStorageStateStore } from 'oidc-client-ts';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

export const AUTH_MODE = (import.meta.env.VITE_AUTH_MODE ?? 'oidc') as 'oidc' | 'dev';

export const DEMO_ACCOUNTS = [
  { email: 'employee@hr.local', label: 'Nhân viên – Trần Thị Nhân' },
  { email: 'manager@hr.local', label: 'Quản lý – Nguyễn Văn Quản' },
  { email: 'hr@hr.local', label: 'HR – Lê Thu Hằng' },
  { email: 'admin@hr.local', label: 'Admin – Phạm Minh Quân' },
];

/**
 * Đăng nhập OIDC Authorization Code + PKCE (client public "hr-web" trên Keycloak).
 * Token giữ trong sessionStorage (mất khi đóng tab) và tự gia hạn trước khi hết hạn.
 */
export const userManager = new UserManager({
  authority: import.meta.env.VITE_OIDC_AUTHORITY ?? 'http://localhost:8080/realms/hr',
  client_id: import.meta.env.VITE_OIDC_CLIENT_ID ?? 'hr-web',
  redirect_uri: `${window.location.origin}/callback`,
  post_logout_redirect_uri: window.location.origin,
  response_type: 'code',
  scope: 'openid profile email',
  automaticSilentRenew: true,
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
});

const DEV_KEY = 'hr.devUser';

interface AuthState {
  ready: boolean;
  token: string | null;
  login: (devEmail?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

let currentToken: string | null = null;
/** Dùng trong api client (ngoài React). */
export const getToken = () => currentToken;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const apply = (t: string | null) => {
    currentToken = t;
    setToken(t);
  };

  useEffect(() => {
    if (AUTH_MODE === 'dev') {
      const email = sessionStorage.getItem(DEV_KEY);
      apply(email ? `dev:${email}` : null);
      setReady(true);
      return;
    }
    const onLoaded = (u: User) => apply(u.access_token);
    const onUnloaded = () => apply(null);
    userManager.events.addUserLoaded(onLoaded);
    userManager.events.addUserUnloaded(onUnloaded);
    userManager
      .getUser()
      .then((u) => apply(u && !u.expired ? u.access_token : null))
      .finally(() => setReady(true));
    return () => {
      userManager.events.removeUserLoaded(onLoaded);
      userManager.events.removeUserUnloaded(onUnloaded);
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      token,
      login: async (devEmail?: string) => {
        if (AUTH_MODE === 'dev') {
          sessionStorage.setItem(DEV_KEY, devEmail ?? DEMO_ACCOUNTS[0].email);
          apply(`dev:${devEmail ?? DEMO_ACCOUNTS[0].email}`);
          return;
        }
        await userManager.signinRedirect();
      },
      logout: async () => {
        apply(null);
        if (AUTH_MODE === 'dev') {
          sessionStorage.removeItem(DEV_KEY);
          return;
        }
        await userManager.signoutRedirect();
      },
    }),
    [ready, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải nằm trong AuthProvider');
  return ctx;
}
