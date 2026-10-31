import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'parent_id', type: 'bigint', unsigned: true, default: 0 })
  parentId: string;

  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Column({ name: 'icon_url', type: 'varchar', length: 512, default: '' })
  iconUrl: string;

  @Column({ type: 'int', default: 0 })
  sort: number;

  @Column({ name: 'book_count', type: 'int', unsigned: true, default: 0 })
  bookCount: number;

  @Column({ type: 'varchar', length: 16, default: 'enabled' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true })
  deletedAt: Date | null;
}