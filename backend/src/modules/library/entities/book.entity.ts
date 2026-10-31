import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('books')
export class Book {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  isbn: string | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  subtitle: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  author: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  translator: string;

  @Column({ type: 'varchar', length: 128, default: '' })
  publisher: string;

  @Column({ name: 'published_date', type: 'varchar', length: 20, default: '' })
  publishedDate: string;

  @Column({ type: 'int', unsigned: true, default: 0 })
  pages: number;

  @Column({ name: 'cover_url', type: 'varchar', length: 512, default: '' })
  coverUrl: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'category_id', type: 'bigint', unsigned: true, nullable: true })
  categoryId: string | null;

  @Column({ name: 'rating_avg', type: 'decimal', precision: 3, scale: 2, unsigned: true, default: 0.0 })
  ratingAvg: string;

  @Column({ name: 'rating_count', type: 'int', unsigned: true, default: 0 })
  ratingCount: number;

  @Column({ name: 'review_count', type: 'int', unsigned: true, default: 0 })
  reviewCount: number;

  @Column({ name: 'shelf_count', type: 'int', unsigned: true, default: 0 })
  shelfCount: number;

  @Column({ name: 'want_count', type: 'int', unsigned: true, default: 0 })
  wantCount: number;

  @Column({ name: 'reading_count', type: 'int', unsigned: true, default: 0 })
  readingCount: number;

  @Column({ name: 'finished_count', type: 'int', unsigned: true, default: 0 })
  finishedCount: number;

  @Column({ name: 'short_code', type: 'varchar', length: 16, nullable: true })
  shortCode: string | null;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: string;

  @Column({ type: 'varchar', length: 16, default: 'manual' })
  source: string;

  @Column({ name: 'created_by', type: 'bigint', unsigned: true, nullable: true })
  createdBy: string | null;

  @Column({ name: 'published_at', type: 'datetime', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true })
  deletedAt: Date | null;
}