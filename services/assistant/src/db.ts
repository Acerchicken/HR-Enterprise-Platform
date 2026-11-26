import { readFileSync } from 'fs';
import { Pool } from 'pg';
import { AssistantConfig } from './config';

/** Pool tới PostgreSQL bằng user `assistant_svc` (chỉ có quyền trên schema `assistant`, ADR-16 mục 1). */
export function createPool(cfg: AssistantConfig['db']): Pool {
  const ssl =
    cfg.ssl === 'off'
      ? false
      : cfg.ssl === 'verify'
        ? { ca: readFileSync(cfg.sslCaFile!, 'utf8'), rejectUnauthorized: true }
        : { rejectUnauthorized: false };
  return new Pool({ connectionString: cfg.url, ssl, max: 5 });
}
