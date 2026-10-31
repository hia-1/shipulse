import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('user_badges')
@Index('uk_user_badge', ['userId', 'badgeId'], { unique: true })
export class UserBadge {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId: string;

  @Column({ name: 'badge_id', type: 'bigint', unsigned: true })
  badgeId: string;

  @CreateDateColumn({ name: 'unlocked_at' })
  unlockedAt: Date;
}
