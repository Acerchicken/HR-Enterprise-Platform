import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Ngày nghỉ lễ (kể cả ngày nghỉ bù) không trừ vào phép – BR-03. */
@Entity({ schema: 'leave', name: 'holiday' })
export class Holiday {
  @PrimaryColumn({ name: 'holiday_date', type: 'date' })
  date: string;

  @Column({ length: 100 })
  name: string;
}
