import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type GoalType = 'yearly' | 'monthly';
export type GoalStatus = 'active' | 'achieved' | 'archived';

@Entity('reading_goals')
@Index('uk_user_type_period', ['userId', 'goalType', 'period'], { unique: true })
export class ReadingGoal {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId: string;

  @Column({ name: 'goal_type', type: 'varchar', length: 16 })
  goalType: GoalType;

  @Column({ type: 'varchar', length: 10 })
  period: string;

  @Column({ name: 'target_minutes', type: 'int', unsigned: true, default: 0 })
  targetMinutes: number;

  @Column({ name: 'target_books', type: 'int', unsigned: true, default: 0 })
  targetBooks: number;

  @Column({ name: 'actual_minutes', type: 'int', unsigned: true, default: 0 })
  actualMinutes: number;

  @Column({ name: 'actual_books', type: 'int', unsigned: true, default: 0 })
  actualBooks: number;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: GoalStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;
}
