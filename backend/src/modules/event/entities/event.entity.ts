import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type EventType = 'reading_camp' | 'activity';
/** 状态机：draft 草稿 → ongoing 报名/进行中 → finished 已结束；canceled 已取消 */
export type EventStatus = 'draft' | 'ongoing' | 'finished' | 'canceled';

@Entity('events')
@Index('idx_status_time', ['status', 'startTime'])
@Index('idx_type', ['type'])
export class Event {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ length: 128 })
  title: string;

  @Column({ length: 16, default: 'activity' })
  type: EventType;

  @Column({ name: 'cover_url', length: 512, default: '' })
  coverUrl: string;

  @Column({ type: 'mediumtext', nullable: true })
  description: string | null;

  @Column({ name: 'start_time', type: 'datetime' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'datetime' })
  endTime: Date;

  @Column({ name: 'signup_start', type: 'datetime', nullable: true })
  signupStart: Date | null;

  @Column({ name: 'signup_end', type: 'datetime', nullable: true })
  signupEnd: Date | null;

  @Column({ type: 'int', unsigned: true, default: 0 })
  capacity: number;

  @Column({ name: 'signup_count', type: 'int', unsigned: true, default: 0 })
  signupCount: number;

  @Column({ name: 'member_only', type: 'tinyint', default: 0 })
  memberOnly: number;

  @Column({ length: 16, default: 'draft' })
  status: EventStatus;

  @Column({ name: 'created_by', type: 'bigint', unsigned: true, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true })
  deletedAt: Date | null;
}
