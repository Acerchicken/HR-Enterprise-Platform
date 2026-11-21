import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Phân công duyệt thay (BR-06, UC4 13.1): `delegateId` duyệt thay `managerId` trong [startDate, endDate]. */
@Entity({ schema: 'leave', name: 'approval_delegation' })
export class ApprovalDelegation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'manager_id', type: 'uuid' })
  managerId: string;

  @Column({ name: 'delegate_id', type: 'uuid' })
  delegateId: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  @Column({ name: 'ended_by', type: 'uuid', nullable: true })
  endedBy: string | null;
}
