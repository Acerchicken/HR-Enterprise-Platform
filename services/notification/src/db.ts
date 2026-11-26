import { readFileSync } from 'fs';
import { Pool } from 'pg';
import { NotificationConfig } from './config';

/** Pool tới PostgreSQL bằng user `notification_svc` (chỉ có quyền trên schema `notification`, ADR-15). */
export function createPool(cfg: NotificationConfig['db']): Pool {
  const ssl =
    cfg.ssl === 'off'
      ? false
      : cfg.ssl === 'verify'
        ? { ca: readFileSync(cfg.sslCaFile!, 'utf8'), rejectUnauthorized: true }
        : { rejectUnauthorized: false };
  return new Pool({ connectionString: cfg.url, ssl, max: 5, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
}
