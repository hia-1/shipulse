import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('membership_plans')
export class MembershipPlan {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ unique: true, length: 32 })
  code: string;

  @Column({ length: 64 })
  name: string;

  @Column({ length: 500, default: '' })
  description: string;

  @Column({ name: 'price_fen', type: 'int', unsigned: true })
  priceFen: number;

  @Column({ name: 'original_price_fen', type: 'int', unsigned: true, default: 0 })
  originalPriceFen: number;

  @Column({ name: 'duration_days', type: 'int', unsigned: true })
  durationDays: number;

  @Column({ type: 'json', nullable: true })
  benefits: string[] | null;

  @Column({ type: 'int', default: 0 })
  sort: number;

  @Column({ length: 16, default: 'on' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true })
  deletedAt: Date | null;
}