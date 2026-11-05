import 'reflect-metadata';
import { readFileSync } from 'fs';
import { DataSource, DataSourceOptions } from 'typeorm';
import { loadConfig } from '../config/config';

const cfg = loadConfig();

/** Dùng chung cho app (TypeOrmModule) và CLI migration/seed. */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: cfg.db.host,
  port: cfg.db.port,
  username: cfg.db.user,
  password: cfg.db.password,
  database: cfg.db.database,
  // TLS tới DB (RDS bật rds.force_ssl). verify: kiểm tra chứng chỉ theo CA của RDS trong DB_SSL_CA_FILE.
  ssl:
    cfg.db.ssl === 'off'
      ? false
      : cfg.db.ssl === 'verify'
        ? { ca: readFileSync(cfg.db.sslCaFile!, 'utf8'), rejectUnauthorized: true }
        : { rejectUnauthorized: false },
  entities: [__dirname + '/../modules/**/*.entity.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
  logging: ['error'],
};

export default new DataSource(dataSourceOptions);
