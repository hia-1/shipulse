import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type EventSignupStatus = 'signed' | 'canceled' | 'attended';

@Entity('event_signups')
@Index('uk_event_user', ['eventId', 'userId'], { unique: true })
@Index('idx_user_id', ['userId'])
export class EventSignup {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'event_id', type: 'bigint', unsigned: true })
  eventId: string;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId: string;

  @Column({ length: 16, default: 'signed' })
  status: EventSignupStatus;

  @CreateDateColumn({ name: 'signup_time', type: 'datetime', precision: 3 })
  signupTime: Date;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;
}
