import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** 管理员操作日志（只追加，不更新不删除） */
@Entity('operation_logs')
@Index('idx_admin_created', ['adminId', 'createdAt'])
@Index('idx_module_created', ['module', 'createdAt'])
export class OperationLog {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'admin_id', type: 'bigint', unsigned: true, default: 0 })
  adminId: string;

  @Column({ length: 64, default: '' })
  username: string;

  @Column({ length: 32, default: '' })
  module: string;

  @Column({ length: 64, default: '' })
  action: string;

  @Column({ length: 10, default: '' })
  method: string;

  @Column({ length: 255, default: '' })
  path: string;

  @Column({ type: 'json', nullable: true })
  params: object | null;

  @Column({ length: 45, default: '' })
  ip: string;

  @Column({ name: 'user_agent', length: 255, default: '' })
  userAgent: string;

  @Column({ name: 'status_code', type: 'int', default: 0 })
  statusCode: number;

  @Column({ name: 'duration_ms', type: 'int', default: 0 })
  durationMs: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;
}
