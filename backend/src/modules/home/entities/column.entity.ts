import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 每周好书 / 编辑专栏（表名为保留字 columns，已在注释中反引号） */
@Entity('columns')
export class ColumnItem {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'varchar', length: 16 })
  type: string;

  @Column({ type: 'varchar', length: 128 })
  title: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  subtitle: string;

  @Column({ name: 'book_id', type: 'bigint', unsigned: true, nullable: true })
  bookId: string | null;

  @Column({ name: 'cover_url', type: 'varchar', length: 512, default: '' })
  coverUrl: string;

  @Column({ type: 'mediumtext', nullable: true })
  content: string | null;

  @Column({ type: 'int', default: 0 })
  sort: number;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: string;

  @Column({ name: 'published_at', type: 'datetime', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'created_by', type: 'bigint', unsigned: true, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;
}