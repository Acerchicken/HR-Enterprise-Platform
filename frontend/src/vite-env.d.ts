/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_AUTH_MODE?: 'oidc' | 'dev';
  readonly VITE_OIDC_AUTHORITY?: string;
  readonly VITE_OIDC_CLIENT_ID?: string;
  /** Phút không thao tác thì tự đăng xuất (UC8 AC-8.1.6), mặc định 30. */
  readonly VITE_IDLE_TIMEOUT_MINUTES?: string;
}
