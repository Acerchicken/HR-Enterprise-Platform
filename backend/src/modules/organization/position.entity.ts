import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'org', name: 'position' })
export class Position {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20, unique: true })
  code: string;

  @Column({ length: 100 })
  title: string;

  @Column({ type: 'smallint' })
  level: number;
}
