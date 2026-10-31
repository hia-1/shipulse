import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ReviewAuditStatus = 'pending' | 'approved' | 'rejected';

@Entity('reviews')
@Index('idx_book_created', ['bookId', 'createdAt'])
@Index('idx_audit_published', ['auditStatus', 'publishedAt'])
@Index('idx_featured', ['isFeatured', 'publishedAt'])
export class Review {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'short_code', type: 'varchar', length: 16, nullable: true })
  shortCode: string | null;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId: string;

  @Column({ name: 'book_id', type: 'bigint', unsigned: true })
  bookId: string;

  @Column({ type: 'decimal', precision: 2, scale: 1, unsigned: true })
  rating: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  title: string;

  @Column({ type: 'mediumtext', nullable: true })
  content: string | null;

  @Column({ name: 'like_count', type: 'int', unsigned: true, default: 0 })
  likeCount: number;

  @Column({ name: 'comment_count', type: 'int', unsigned: true, default: 0 })
  commentCount: number;

  @Column({ name: 'audit_status', type: 'varchar', length: 16, default: 'pending' })
  auditStatus: ReviewAuditStatus;

  @Column({ name: 'audit_reason', type: 'varchar', length: 255, default: '' })
  auditReason: string;

  @Column({ name: 'machine_score', type: 'int', nullable: true })
  machineScore: number | null;

  @Column({ name: 'is_featured', type: 'tinyint', default: 0 })
  isFeatured: number;

  @Column({ name: 'published_at', type: 'datetime', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;
}