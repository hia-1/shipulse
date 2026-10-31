import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('banners')
export class Banner {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'varchar', length: 128 })
  title: string;

  @Column({ name: 'image_url', type: 'varchar', length: 512 })
  imageUrl: string;

  @Column({ type: 'varchar', length: 32, default: 'home_top' })
  position: string;

  @Column({ name: 'link_type', type: 'varchar', length: 16, default: 'none' })
  linkType: string;

  @Column({ name: 'link_value', type: 'varchar', length: 512, default: '' })
  linkValue: string;

  @Column({ type: 'int', default: 0 })
  sort: number;

  @Column({ name: 'start_time', type: 'datetime', nullable: true })
  startTime: Date | null;

  @Column({ name: 'end_time', type: 'datetime', nullable: true })
  endTime: Date | null;

  @Column({ type: 'varchar', length: 16, default: 'on' })
  status: string;

  @Column({ name: 'created_by', type: 'bigint', unsigned: true, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;
}