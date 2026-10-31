import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 话题（运营域）：动态流按话题聚合的入口 */
@Entity('topics')
@Index('idx_status_sort', ['status', 'sort'])
export class Topic {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'varchar', length: 128 })
  title: string;

  @Column({ type: 'varchar', length: 500, default: '' })
  description: string;

  @Column({ name: 'cover_url', type: 'varchar', length: 512, default: '' })
  coverUrl: string;

  @Column({ name: 'post_count', type: 'int', unsigned: true, default: 0 })
  postCount: number;

  @Column({ type: 'int', default: 0 })
  sort: number;

  @Column({ type: 'varchar', length: 16, default: 'on' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;
}