import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ length: 64, default: '' })
  nickname: string;

  @Column({ name: 'avatar_url', length: 512, default: '' })
  avatarUrl: string;

  @Column({ type: 'tinyint', default: 0 })
  gender: number;

  @Column({ length: 200, default: '' })
  bio: string;

  @Column({ length: 16, default: 'active' })
  status: string;

  @Column({ name: 'muted_until', type: 'datetime', nullable: true })
  mutedUntil: Date | null;

  @Column({ name: 'token_version', type: 'int', unsigned: true, default: 0 })
  tokenVersion: number;

  @Column({ name: 'is_member', type: 'tinyint', default: 0 })
  isMember: number;

  @Column({ name: 'member_expire_at', type: 'datetime', nullable: true })
  memberExpireAt: Date | null;

  @Column({ name: 'book_count', type: 'int', unsigned: true, default: 0 })
  bookCount: number;

  @Column({ name: 'review_count', type: 'int', unsigned: true, default: 0 })
  reviewCount: number;

  @Column({ name: 'post_count', type: 'int', unsigned: true, default: 0 })
  postCount: number;

  @Column({ name: 'follower_count', type: 'int', unsigned: true, default: 0 })
  followerCount: number;

  @Column({ name: 'following_count', type: 'int', unsigned: true, default: 0 })
  followingCount: number;

  @Column({ name: 'last_login_at', type: 'datetime', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true })
  deletedAt: Date | null;
}
