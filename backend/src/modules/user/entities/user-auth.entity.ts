import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('user_auths')
export class UserAuth {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId: number;

  @Column({ name: 'identity_type', length: 20 })
  identityType: string;

  @Column({ length: 128 })
  identifier: string;

  @Column({ length: 255, default: '' })
  credential: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  unionid: string | null;

  @Column({ type: 'tinyint', default: 0 })
  verified: number;

  @Column({ name: 'last_used_at', type: 'datetime', nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;
}
