import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export type HolidayKind = 'HOLIDAY' | 'COMPENSATORY';

/** Ngày nghỉ lễ, nghỉ bù không trừ phép (BR-03); HR sửa được (FR-4.9, BR-19). */
@Entity({ schema: 'leave', name: 'holiday' })
export class Holiday {
  @PrimaryColumn({ name: 'holiday_date', type: 'date' })
  date: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 12 })
  kind: HolidayKind;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
