import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 会员订阅表 */
@Entity('member_subscriptions')
export class MemberSubscription {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId: string;

  @Column({ name: 'plan_id', type: 'bigint', unsigned: true })
  planId: string;

  @Column({ name: 'order_id', type: 'bigint', unsigned: true, nullable: true })
  orderId: string | null;

  @Column({ name: 'start_time', type: 'datetime' })
  startTime: Date;

  @Column({ name: 'expire_time', type: 'datetime' })
  expireTime: Date;

  @Column({ length: 16, default: 'active' })
  status: string;

  @Column({ name: 'auto_renew', type: 'tinyint', default: 0 })
  autoRenew: number;

  @Column({ length: 16, default: 'wechat' })
  channel: string;

  @Column({ name: 'remind_7_sent', type: 'tinyint', default: 0 })
  remind7Sent: number;

  @Column({ name: 'remind_3_sent', type: 'tinyint', default: 0 })
  remind3Sent: number;

  @Column({ name: 'remind_1_sent', type: 'tinyint', default: 0 })
  remind1Sent: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;
}