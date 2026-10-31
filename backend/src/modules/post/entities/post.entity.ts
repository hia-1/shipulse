import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type PostType = 'checkin' | 'text';
export type PostAuditStatus = 'pending' | 'approved' | 'rejected';

@Entity('posts')
@Index('idx_created_at', ['createdAt'])
@Index('idx_user_id', ['userId'])
@Index('idx_audit_published', ['auditStatus', 'publishedAt'])
@Index('idx_book_id', ['bookId'])
export class Post {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'short_code', type: 'varchar', length: 16, nullable: true })
  shortCode: string | null;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId: string;

  @Column({ type: 'varchar', length: 16, default: 'checkin' })
  type: PostType;

  @Column({ name: 'book_id', type: 'bigint', unsigned: true, nullable: true })
  bookId: string | null;

  @Column({ name: 'topic_id', type: 'bigint', unsigned: true, nullable: true })
  topicId: string | null;

  @Column({ type: 'varchar', length: 2000, default: '' })
  content: string;

  @Column({ type: 'json', nullable: true })
  images: string[] | null;

  @Column({ type: 'varchar', length: 128, default: '' })
  location: string;

  @Column({ name: 'read_minutes', type: 'int', unsigned: true, default: 0 })
  readMinutes: number;

  @Column({ name: 'like_count', type: 'int', unsigned: true, default: 0 })
  likeCount: number;

  @Column({ name: 'comment_count', type: 'int', unsigned: true, default: 0 })
  commentCount: number;

  @Column({ name: 'audit_status', type: 'varchar', length: 16, default: 'pending' })
  auditStatus: PostAuditStatus;

  @Column({ name: 'machine_score', type: 'int', nullable: true })
  machineScore: number | null;

  @Column({ name: 'audit_reason', type: 'varchar', length: 255, default: '' })
  auditReason: string;

  @Column({ name: 'published_at', type: 'datetime', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true })
  deletedAt: Date | null;
}