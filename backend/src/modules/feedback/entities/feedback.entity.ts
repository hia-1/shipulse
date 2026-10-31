import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type FeedbackType = 'suggestion' | 'bug' | 'other';
export type FeedbackStatus = 'pending' | 'processing' | 'replied' | 'closed';

/** 意见反馈（P2-06）：用户提交，管理端可回复 */
@Entity('feedback')
@Index('idx_user_id', ['userId'])
@Index('idx_status_created', ['status', 'createdAt'])
export class Feedback {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId: string;

  @Column({ type: 'varchar', length: 16, default: 'suggestion' })
  type: FeedbackType;

  @Column({ type: 'varchar', length: 1000 })
  content: string;

  @Column({ type: 'json', nullable: true })
  images: string[] | null;

  @Column({ type: 'varchar', length: 128, default: '' })
  contact: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: FeedbackStatus;

  @Column({ type: 'varchar', length: 1000, default: '' })
  reply: string;

  @Column({ name: 'handler_id', type: 'bigint', unsigned: true, nullable: true })
  handlerId: string | null;

  @Column({ name: 'replied_at', type: 'datetime', nullable: true })
  repliedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  deletedAt: Date | null;
}
