import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../modules/user/entities/user.entity';
import { Admin } from '../../modules/admin/entities/admin.entity';

/**
 * 令牌状态中心：把「账号是否可用」与「令牌版本」作为每次鉴权的事实来源。
 * 目的：封禁 / 改密 / 注销 / 登出后，已签发的 access、refresh 立即失效，
 * 不再依赖 access 2h、refresh 30d 的自然过期。
 */
@Injectable()
export class AuthStateService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Admin) private readonly adminRepo: Repository<Admin>,
  ) {}

  /** 用户令牌是否仍有效：账号未被封禁/注销，且令牌版本与库一致 */
  async isUserTokenValid(userId: number, tokenVersion?: number): Promise<boolean> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return false;
    if (user.status !== 'active' && user.status !== 'muted') return false;
    return Number(user.tokenVersion ?? 0) === Number(tokenVersion ?? 0);
  }

  /** 管理员令牌是否仍有效：账号启用，且令牌版本与库一致 */
  async isAdminTokenValid(adminId: number, tokenVersion?: number): Promise<boolean> {
    const admin = await this.adminRepo.findOne({ where: { id: adminId } });
    if (!admin) return false;
    if (admin.status !== 'active') return false;
    return Number(admin.tokenVersion ?? 0) === Number(tokenVersion ?? 0);
  }

  /** 令牌版本 +1：使该账号已签发的全部 access / refresh 立即失效（封禁 / 改密 / 登出） */
  async bumpUserTokenVersion(userId: number): Promise<void> {
    await this.userRepo.increment({ id: userId }, 'tokenVersion', 1);
  }

  async bumpAdminTokenVersion(adminId: number): Promise<void> {
    await this.adminRepo.increment({ id: adminId }, 'tokenVersion', 1);
  }

  /** 写入侧校验：仅正常状态可发布内容；禁言 / 封禁一律拒绝 */
  async assertCanWrite(userId: number): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('账号不存在');
    // 禁言到期自动恢复：无需人工干预，到期即恢复发布能力
    if (user.status === 'muted') {
      if (!user.mutedUntil || user.mutedUntil.getTime() <= Date.now()) {
        user.status = 'active';
        user.mutedUntil = null;
        await this.userRepo.save(user);
        return;
      }
      throw new ForbiddenException('你已被禁言，暂无法发布内容');
    }
    if (user.status !== 'active') {
      throw new ForbiddenException('账号状态异常，无法发布内容');
    }
  }

  /** 对用户施加处罚：禁言（到期自动恢复）/ 封禁（令牌立即失效） */
  async applyPunishment(
    userId: number,
    level: 'mute' | 'ban',
    muteDays = 7,
  ): Promise<{ status: string; mutedUntil: Date | null }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('账号不存在');
    if (level === 'mute') {
      user.status = 'muted';
      user.mutedUntil = new Date(Date.now() + muteDays * 24 * 60 * 60 * 1000);
    } else {
      user.status = 'banned';
      user.mutedUntil = null;
    }
    await this.userRepo.save(user);
    if (level === 'ban') {
      await this.bumpUserTokenVersion(userId);
    }
    return { status: user.status, mutedUntil: user.mutedUntil };
  }

  /** 撤销处罚（申诉改判通过）：恢复为正常状态并清除禁言到期时间 */
  async revokePunishment(userId: number): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return;
    if (user.status === 'muted' || user.status === 'banned') {
      user.status = 'active';
      user.mutedUntil = null;
      await this.userRepo.save(user);
    }
  }
}