import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** 管理员-角色关联表（纯关联表，仅 created_at） */
@Entity('admin_roles')
@Index('idx_role_id', ['roleId'])
export class AdminRole {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'admin_id', type: 'bigint', unsigned: true })
  adminId: string;

  @Column({ name: 'role_id', type: 'bigint', unsigned: true })
  roleId: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;
}
