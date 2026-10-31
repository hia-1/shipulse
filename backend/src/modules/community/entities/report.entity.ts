import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ModerationTarget } from '../moderation.service';

export type ReportStatus = 'pending' | 'processing' | 'resolved' | 'rejected';
export type ReportReason =
  | 'porn'
  | 'abuse'
  | 'ad'
  | 'spam'
  | 'infringe'
  | 'other';

@Entity('reports')
@Index('idx_status_created', ['status', 'createdAt'])
@Index('idx_target', ['targetType', 'targetId'])
export class Report {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'reporter_id', type: 'bigint', unsigned: true })
  reporterId: string;

  @Column({ name: 'reporter_type', type: 'varchar', length: 16, default: 'user' })
  reporterType: 'user' | 'admin';

  @Column({ name: 'target_type', type: 'varchar', length: 16 })
  targetType: ModerationTarget;

  @Column({ name: 'target_id', type: 'bigint', unsigned: true })
  targetId: string;

  @Column({ type: 'varchar', length: 32 })
  reason: ReportReason;

  @Column({ type: 'varchar', length: 500, default: '' })
  description: string;

  @Column({ type: 'json', nullable: true })
  images: string[] | null;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: ReportStatus;

  @Column({ name: 'handler_id', type: 'bigint', unsigned: true, nullable: true })
  handlerId: string | null;

  @Column({ name: 'handle_result', type: 'varchar', length: 255, default: '' })
  handleResult: string;

  @Column({ name: 'handled_at', type: 'datetime', nullable: true })
  handledAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true })
  deletedAt: Date | null;
}
