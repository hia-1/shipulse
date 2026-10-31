import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { PageQueryDto, pageParams, toList, UpdateUserStatusDto } from '../dto/manage.dto';
import { AuthStateService } from '../../../common/auth-state/auth-state.service';

/** 手机号脱敏：保留前 3 后 4，中间以 **** 代替（138****0001） */
function maskPhone(phone: string | null): string {
  if (!phone) return '';
  if (phone.length < 7) return phone.replace(/./g, '*');
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

@Injectable()
export class AdminUserService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly authState: AuthStateService,
  ) {}

  async list(query: PageQueryDto) {
    const { page, size, skip } = pageParams(query.page, query.size);
    const qb = this.userRepo.createQueryBuilder('u');
    if (query.keyword) {
      const kw = `%${query.keyword}%`;
      qb.andWhere('(u.nickname LIKE :kw OR u.phone LIKE :kw OR u.id LIKE :kw)', { kw });
    }
    if (query.status) {
      qb.andWhere('u.status = :status', { status: query.status });
    }
    const [rows, total] = await qb
      .orderBy('u.created_at', 'DESC')
      .skip(skip)
      .take(size)
      .getManyAndCount();
    const items = rows.map((u) => ({
      id: Number(u.id),
      nickname: u.nickname,
      phone: maskPhone(u.phone),
      avatarUrl: u.avatarUrl,
      gender: u.gender,
      status: u.status,
      isMember: u.isMember,
      memberExpireAt: u.memberExpireAt,
      bookCount: u.bookCount,
      reviewCount: u.reviewCount,
      postCount: u.postCount,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    }));
    return toList(items, total, page, size);
  }

  async updateStatus(id: string, dto: UpdateUserStatusDto) {
    const user = await this.userRepo.findOne({ where: { id: Number(id) } });
    if (!user) throw new NotFoundException('用户不存在');
    const changed = user.status !== dto.status;
    user.status = dto.status;
    await this.userRepo.save(user);
    // 封禁/注销：令牌版本 +1，令其已签发令牌立即失效（禁言不踢下线，仅限制发布）
    if (changed && dto.status !== 'active' && dto.status !== 'muted') {
      await this.authState.bumpUserTokenVersion(Number(user.id));
    }
    return { id: Number(user.id), status: user.status };
  }

  async toggleMember(id: string, isMember: number) {
    const user = await this.userRepo.findOne({ where: { id: Number(id) } });
    if (!user) throw new NotFoundException('用户不存在');
    user.isMember = isMember ? 1 : 0;
    if (!user.isMember) user.memberExpireAt = null;
    await this.userRepo.save(user);
    return { id: Number(user.id), isMember: user.isMember };
  }
}