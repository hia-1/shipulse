import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type LikeTargetType = 'review' | 'post' | 'comment' | 'booklist';

@Entity('likes')
@Index('uk_user_target', ['userId', 'targetType', 'targetId', 'interactionType'], {
  unique: true,
})
export class Like {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId: string;

  @Column({ name: 'target_type', type: 'varchar', length: 16 })
  targetType: LikeTargetType;

  @Column({ name: 'target_id', type: 'bigint', unsigned: true })
  targetId: string;

  @Column({ name: 'interaction_type', type: 'varchar', length: 10, default: 'like' })
  interactionType: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;
}