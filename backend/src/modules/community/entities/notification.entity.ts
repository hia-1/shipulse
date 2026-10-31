import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type NotificationType =
  | 'like'
  | 'comment'
  | 'follow'
  | 'system'
  | 'order'
  | 'audit';

/** 站内通知（一期单表；处罚告知/申诉结果等系统消息走此表） */
@Entity('notifications')
@Index('idx_user_read', ['userId', 'isRead', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  type: NotificationType;

  @Column({ type: 'varchar', length: 128, default: '' })
  title: string;

  @Column({ type: 'varchar', length: 500, default: '' })
  content: string;

  @Column({ name: 'sender_id', type: 'bigint', unsigned: true, default: 0 })
  senderId: string;

  @Column({ name: 'target_type', type: 'varchar', length: 16, default: '' })
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
