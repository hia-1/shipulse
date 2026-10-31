import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 支付流水表（只追加，对账依据） */
@Entity('payment_records')
export class PaymentRecord {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'order_id', type: 'bigint', unsigned: true })
  orderId: string;

  @Column({ name: 'payment_no', length: 64, default: '' })
  paymentNo: string;

  @Column({ name: 'transaction_id', type: 'varchar', length: 64, nullable: true })
  transactionId: string | null;

  @Column({ length: 16, default: 'wechat' })
  channel: string;

  @Column({ name: 'amount_fen', type: 'int', unsigned: true })
  amountFen: number;

  @Column({ length: 16, default: 'pending' })
  status: string;

  @Column({ name: 'raw_callback', type: 'json', nullable: true })
  rawCallback: Record<string, unknown> | null;

  @Column({ name: 'paid_at', type: 'datetime', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;
}