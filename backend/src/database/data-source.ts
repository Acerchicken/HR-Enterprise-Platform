import 'reflect-metadata';
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
  entities: [__dirname + '/../modules/**/*.entity.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
  logging: ['error'],
};

export default new DataSource(dataSourceOptions);
