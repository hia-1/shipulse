import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** 站内通知表（这里用于会员到期提醒落库） */
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId: string;

  @Column({ length: 20 })
  type: string;

  @Column({ length: 128, default: '' })
  title: string;

  @Column({ length: 500, default: '' })
  content: string;

  @Column({ name: 'sender_id', type: 'bigint', unsigned: true, default: 0 })
  senderId: string;

  @Column({ name: 'target_type', length: 16, default: '' })
  targetType: string;

  @Column({ name: 'target_id', type: 'bigint', unsigned: true, default: 0 })
  targetId: string;

  @Column({ name: 'is_read', type: 'tinyint', default: 0 })
  isRead: number;

  @Column({ name: 'read_at', type: 'datetime', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;
}