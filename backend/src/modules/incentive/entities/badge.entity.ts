import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type BadgeCategory = 'streak' | 'goal' | 'social' | 'special';
export type BadgeRuleType = 'streak' | 'books' | 'review' | 'goal' | 'manual';
export type BadgeStatus = 'on' | 'off';

@Entity('badges')
@Index('uk_code', ['code'], { unique: true })
export class Badge {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'varchar', length: 64 })
  code: string;

  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  description: string;

  @Column({ name: 'icon_url', type: 'varchar', length: 512, default: '' })
  iconUrl: string;

  @Column({ type: 'varchar', length: 32, default: 'special' })
  category: BadgeCategory;

  @Column({ name: 'rule_type', type: 'varchar', length: 32, default: 'manual' })
  ruleType: BadgeRuleType;

  @Column({ name: 'rule_value', type: 'int', unsigned: true, nullable: true })
  ruleValue: number | null;

  @Column({ name: 'rule_config', type: 'json', nullable: true })
  ruleConfig: Record<string, unknown> | null;

  @Column({ type: 'int', default: 0 })
  sort: number;

  @Column({ type: 'varchar', length: 16, default: 'on' })
  status: BadgeStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;
}
