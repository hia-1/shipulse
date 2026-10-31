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

export type AppealStatus = 'pending' | 'approved' | 'rejected';

@Entity('appeals')
@Index('idx_status_created', ['status', 'createdAt'])
@Index('idx_target', ['targetType', 'targetId'])
export class Appeal {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId: string;

  @Column({ name: 'target_type', type: 'varchar', length: 16 })
  targetType: ModerationTarget;

  @Column({ name: 'target_id', type: 'bigint', unsigned: true })
  targetId: string;

  @Column({ name: 'moderation_log_id', type: 'bigint', unsigned: true, nullable: true })
  moderationLogId: string | null;

  @Column({ type: 'varchar', length: 500, default: '' })
  reason: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: AppealStatus;

  @Column({ name: 'reviewer_id', type: 'bigint', unsigned: true, nullable: true })
  reviewerId: string | null;

  @Column({ name: 'review_result', type: 'varchar', length: 255, default: '' })
  reviewResult: string;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true })
  deletedAt: Date | null;
}
