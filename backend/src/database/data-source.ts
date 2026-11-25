import 'reflect-metadata';
import { readFileSync } from 'fs';
import { DataSource, DataSourceOptions } from 'typeorm';
import { loadConfig } from '../config/config';

// Chỉ cần phần database; không kiểm tra cấu hình xác thực (file này dùng chung cho API, worker, migration).
const cfg = loadConfig(process.env, { needsAuth: false });

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

/**
 * Cho API và worker (không cho CLI migration, seed: câu lệnh dài như tạo index không bị cắt). pg Pool: giới hạn số kết nối,
 * thời gian chờ lấy kết nối và `statement_timeout` ở phía Postgres (SRS 6.14 "Database chậm": chờ tối đa 5 s rồi trả 503).
 */
export const runtimeDataSourceOptions: DataSourceOptions = {
  ...dataSourceOptions,
  extra: {
    max: cfg.db.poolMax,
    connectionTimeoutMillis: cfg.db.connectTimeoutMs,
    ...(cfg.db.statementTimeoutMs ? { statement_timeout: cfg.db.statementTimeoutMs } : {}),
  },
};

export default new DataSource(dataSourceOptions);
