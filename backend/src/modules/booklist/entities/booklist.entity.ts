import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Index('idx_user_id', ['userId'])
@Index('idx_audit_published', ['auditStatus', 'publishedAt'])
@Index('idx_collect', ['collectCount'])
@Entity('booklists')
export class Booklist {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'short_code', type: 'varchar', length: 16, nullable: true })
  shortCode: string | null;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId: string;

  @Column({ length: 128 })
  title: string;

  @Column({ length: 1000, default: '' })
  description: string;

  @Column({ name: 'cover_url', length: 512, default: '' })
  coverUrl: string;

  @Column({ name: 'item_count', type: 'int', unsigned: true, default: 0 })
  itemCount: number;

  @Column({ name: 'collect_count', type: 'int', unsigned: true, default: 0 })
  collectCount: number;

  @Column({ name: 'like_count', type: 'int', unsigned: true, default: 0 })
  likeCount: number;

  @Column({ name: 'audit_status', length: 16, default: 'pending' })
  auditStatus: string;

  @Column({ name: 'audit_reason', type: 'varchar', length: 255, default: '' })
  auditReason: string;

  @Column({ name: 'machine_score', type: 'int', nullable: true })
  machineScore: number | null;

  @Column({ name: 'is_official', type: 'tinyint', default: 0 })
  isOfficial: number;

  @Column({ name: 'published_at', type: 'datetime', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true })
  deletedAt: Date | null;
}