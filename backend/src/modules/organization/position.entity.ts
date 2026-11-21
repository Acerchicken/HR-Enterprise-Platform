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

  /** AC-2.6.2: chức danh ngừng dùng không còn trong danh sách chọn; người đang giữ không bị đổi. */
  @Column({ default: true })
  active: boolean;

  /** AC-2.6.3: chức danh hệ thống (CEO) không ngừng dùng, không đổi cấp bậc. */
  @Column({ name: 'is_system', default: false })
  isSystem: boolean;
}
