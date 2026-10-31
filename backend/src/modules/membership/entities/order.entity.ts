import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 订单表（财务记录，不做软删除） */
@Entity('orders')
export class MembershipOrder {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'order_no', unique: true, length: 32 })
  orderNo: string;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId: string;

  @Column({ name: 'plan_id', type: 'bigint', unsigned: true, nullable: true })
  planId: string | null;

  @Column({ name: 'order_type', length: 16 })
  orderType: string;

  @Column({ length: 128, default: '' })
  title: string;

  @Column({ name: 'amount_fen', type: 'int', unsigned: true, default: 0 })
  amountFen: number;

  @Column({ length: 16, default: 'pending' })
  status: string;

  @Column({ length: 16, default: 'wechat' })
  channel: string;

  @Column({ name: 'paid_at', type: 'datetime', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'closed_at', type: 'datetime', nullable: true })
  closedAt: Date | null;

  @Column({ name: 'refunded_at', type: 'datetime', nullable: true })
  refundedAt: Date | null;

  @Column({ name: 'refund_reason', length: 255, default: '' })
  refundReason: string;

  @Column({ length: 255, default: '' })
  remark: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;
}