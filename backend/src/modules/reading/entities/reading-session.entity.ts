import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SessionStatus = 'ongoing' | 'finished';

@Entity('reading_sessions')
@Index('idx_user_start', ['userId', 'startTime'])
export class ReadingSession {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId: string;

  @Column({ name: 'book_id', type: 'bigint', unsigned: true })
  bookId: string;

  @Column({ name: 'bookshelf_id', type: 'bigint', unsigned: true, nullable: true })
  bookshelfId: string | null;

  @Column({ name: 'start_time', type: 'datetime' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'datetime', nullable: true })
  endTime: Date | null;

  @Column({ name: 'duration_seconds', type: 'int', unsigned: true, default: 0 })
  durationSeconds: number;

  @Column({ name: 'start_page', type: 'int', unsigned: true, default: 0 })
  startPage: number;

  @Column({ name: 'end_page', type: 'int', unsigned: true, default: 0 })
  endPage: number;

  @Column({ type: 'varchar', length: 1000, default: '' })
  note: string;

  @Column({ type: 'varchar', length: 16, default: 'web' })
  source: string;

  @Column({ type: 'varchar', length: 16, default: 'ongoing' })
  status: SessionStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;
}
