import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { sanitizeText } from '../../common/utils/sanitize';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CancelAccountDto } from './dto/cancel-account.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  ping() {
    return { module: 'user', status: 'skeleton' };
  }

  /** 编辑个人资料：仅更新传入的字段，昵称去空白 */
  async updateProfile(id: number, dto: UpdateProfileDto) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    if (dto.nickname != null) {
      const nickname = sanitizeText(dto.nickname);
      if (!nickname) throw new BadRequestException('昵称不能为空');
      user.nickname = nickname;
    }
    if (dto.avatarUrl != null) user.avatarUrl = dto.avatarUrl.trim();
    if (dto.gender != null) user.gender = dto.gender;
    if (dto.bio != null) user.bio = sanitizeText(dto.bio);

    await this.userRepo.save(user);
    return this.getProfile(id);
  }

  /** 注销账号：须二次确认，软删除并标记状态 */
  async cancelAccount(id: number, dto: CancelAccountDto) {
    if (!dto.confirm) {
      throw new BadRequestException('请确认注销操作');
    }
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    user.status = 'deleted';
    await this.userRepo.softDelete({ id });
    return { deleted: true, id: Number(user.id) };
  }

  /** 设置会员到期时间：到期日期晚于当前即视为有效会员 */
  async setMembership(id: number, until: Date | null) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');
    user.memberExpireAt = until;
    user.isMember = until && until.getTime() > Date.now() ? 1 : 0;
    await this.userRepo.save(user);
    return { isMember: user.isMember, memberExpireAt: user.memberExpireAt };
  }

  async getProfile(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return {
      id: Number(user.id),
      phone: user.phone,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      gender: user.gender,
      bio: user.bio,
      status: user.status,
      isMember: user.isMember,
      memberExpireAt: user.memberExpireAt,
      bookCount: user.bookCount,
      reviewCount: user.reviewCount,
      postCount: user.postCount,
      followerCount: user.followerCount,
      followingCount: user.followingCount,
      createdAt: user.createdAt,
    };
  }
}
