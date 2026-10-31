import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { ModerationTarget } from '../moderation.service';

@Entity('moderation_logs')
@Index('idx_target', ['targetType', 'targetId'])
export class ModerationLog {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'target_type', type: 'varchar', length: 16 })
  targetType: ModerationTarget;

  @Column({ name: 'target_id', type: 'bigint', unsigned: true })
  targetId: string;

  @Column({ type: 'varchar', length: 24 })
  action: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  reason: string;

  @Column({ name: 'operator_type', type: 'varchar', length: 16, default: 'system' })
  operatorType: string;

  @Column({ name: 'operator_id', type: 'bigint', unsigned: true, default: 0 })
  operatorId: string;

  @Column({ type: 'json', nullable: true })
  detail: object | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;
}