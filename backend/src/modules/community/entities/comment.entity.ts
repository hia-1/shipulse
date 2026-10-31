import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CommentTargetType = 'review' | 'post' | 'booklist';

@Entity('comments')
@Index('idx_target', ['targetType', 'targetId', 'createdAt'])
export class Comment {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId: string;

  @Column({ name: 'target_type', type: 'varchar', length: 16 })
  targetType: CommentTargetType;

  @Column({ name: 'target_id', type: 'bigint', unsigned: true })
  targetId: string;

  @Column({ name: 'parent_id', type: 'bigint', unsigned: true, default: 0 })
  parentId: string;

  @Column({ name: 'reply_to_uid', type: 'bigint', unsigned: true, default: 0 })
  replyToUid: string;

  @Column({ type: 'varchar', length: 1000 })
  content: string;

  @Column({ name: 'like_count', type: 'int', unsigned: true, default: 0 })
  likeCount: number;

  @Column({ name: 'audit_status', type: 'varchar', length: 16, default: 'approved' })
  auditStatus: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;
}