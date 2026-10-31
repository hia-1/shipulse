import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 兑换码表 */
@Entity('redeem_codes')
export class RedeemCode {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ unique: true, length: 32 })
  code: string;

  @Column({ name: 'batch_no', length: 32, default: '' })
  batchNo: string;

  @Column({ name: 'plan_id', type: 'bigint', unsigned: true })
  planId: string;

  @Column({ name: 'duration_days', type: 'int', unsigned: true })
  durationDays: number;

  @Column({ length: 16, default: 'unused' })
  status: string;

  @Column({ name: 'used_by', type: 'bigint', unsigned: true, nullable: true })
  usedBy: string | null;

  @Column({ name: 'used_at', type: 'datetime', nullable: true })
  usedAt: Date | null;

  @Column({ name: 'order_id', type: 'bigint', unsigned: true, nullable: true })
  orderId: string | null;

  @Column({ name: 'expires_at', type: 'datetime', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'created_by', type: 'bigint', unsigned: true, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;
}