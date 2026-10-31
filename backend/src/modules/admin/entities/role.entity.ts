import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 管理角色（权限点列表存 JSON） */
@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ length: 64 })
  code: string;

  @Column({ length: 64 })
  name: string;

  @Column({ length: 255, default: '' })
  description: string;

  @Column({ type: 'json' })
  permissions: string[];

  @Column({ name: 'is_builtin', type: 'tinyint', default: 0 })
  isBuiltin: number;

  @Column({ length: 16, default: 'active' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true })
  deletedAt: Date | null;
}
