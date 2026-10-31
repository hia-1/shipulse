import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ShelfStatus = 'want' | 'reading' | 'read';

@Entity('bookshelves')
@Index('uk_user_book', ['userId', 'bookId'], { unique: true })
export class Bookshelf {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId: string;

  @Column({ name: 'book_id', type: 'bigint', unsigned: true })
  bookId: string;

  /** want 想读 / reading 在读 / read 已读 */
  @Column({ type: 'varchar', length: 16, default: 'want' })
  status: ShelfStatus;

  @Column({ name: 'current_page', type: 'int', unsigned: true, default: 0 })
  currentPage: number;

  @Column({ type: 'tinyint', unsigned: true, default: 0 })
  progress: number;

  @Column({ name: 'last_read_at', type: 'datetime', nullable: true })
  lastReadAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;
}