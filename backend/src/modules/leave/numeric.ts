import { ValueTransformer } from 'typeorm';

/** Cột `numeric` của PostgreSQL về `number` (pg trả chuỗi). Số ngày tối đa 999,99 nên không mất độ chính xác. */
export const numeric: ValueTransformer = {
  to: (v: number | null | undefined) => v,
  from: (v: string | null) => (v == null ? null : Number(v)),
};
