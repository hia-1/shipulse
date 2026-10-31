import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 微信订阅消息授权记录。
 * 微信「一次性订阅」每授权一次可下发一条；count 记录当前可下发额度，
 * 每次发送成功扣减 1，授权时累加，便于在授权耗尽时提示用户重新授权。
 */
@Entity('subscribe_authorizations')
@Unique('uk_user_template', ['userId', 'templateId'])
export class SubscribeAuthorization {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId: string;

  @Column({ name: 'template_id', length: 64 })
  templateId: string;

  @Column({ type: 'int', unsigned: true, default: 0 })
  count: number;

  @Column({ name: 'last_authorized_at', type: 'datetime', nullable: true })
  lastAuthorizedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;
}
