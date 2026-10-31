import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import { Badge } from './entities/badge.entity';
import { UserBadge } from './entities/user-badge.entity';
import { GoalService } from './goal.service';
import { ReadingSession } from '../reading/entities/reading-session.entity';

export interface BadgeWithStatus {
  id: number;
  code: string;
  name: string;
  description: string;
  iconUrl: string;
  category: string;
  ruleType: string;
  ruleValue: number | null;
  sort: number;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: number | null;
}

export interface AwardResult {
  awarded: { badgeId: number; code: string; name: string }[];
}

@Injectable()
export class BadgeService {
  private readonly logger = new Logger(BadgeService.name);

  constructor(
    @InjectRepository(Badge)
    private readonly badgeRepo: Repository<Badge>,
    @InjectRepository(UserBadge)
    private readonly userBadgeRepo: Repository<UserBadge>,
    @InjectRepository(ReadingSession)
    private readonly sessionRepo: Repository<ReadingSession>,
    private readonly goalService: GoalService,
    private readonly dataSource: DataSource,
  ) {}

  async getAllBadges(userId: number): Promise<BadgeWithStatus[]> {
    const badges = await this.badgeRepo
      .createQueryBuilder('b')
      .where('b.status = :st', { st: 'on' })
      .andWhere('b.deleted_at IS NULL')
      .orderBy('b.sort', 'ASC')
      .addOrderBy('b.id', 'ASC')
      .getMany();

    const userBadges = await this.userBadgeRepo.find({
      where: { userId: String(userId) },
    });
    const unlockedMap = new Map<string, Date>();
    for (const ub of userBadges) {
      unlockedMap.set(String(ub.badgeId), ub.unlockedAt);
    }

    const streak = await this.goalService.getStreak(userId);
    const totalBooks = await this.goalService.getTotalBooksRead(userId);
    const reviewCount = await this.getApprovedReviewCount(userId);

    return badges.map((b) => {
      const unlockedAt = unlockedMap.get(String(b.id));
      let progress: number | null = null;
      if (!unlockedAt && b.ruleValue) {
        if (b.ruleType === 'streak') progress = Math.min(1, streak.currentStreak / b.ruleValue);
        else if (b.ruleType === 'books') progress = Math.min(1, totalBooks / b.ruleValue);
        else if (b.ruleType === 'review') progress = Math.min(1, reviewCount / b.ruleValue);
      }
      return {
        id: Number(b.id),
        code: b.code,
        name: b.name,
        description: b.description,
        iconUrl: b.iconUrl,
        category: b.category,
        ruleType: b.ruleType,
        ruleValue: b.ruleValue,
        sort: b.sort,
        unlocked: !!unlockedAt,
        unlockedAt: unlockedAt ? unlockedAt.toISOString() : null,
        progress,
      };
    });
  }

  async getMyBadges(userId: number): Promise<BadgeWithStatus[]> {
    const all = await this.getAllBadges(userId);
    return all.filter((b) => b.unlocked);
  }

  async checkAndAward(userId: number): Promise<AwardResult> {
    const badges = await this.badgeRepo
      .createQueryBuilder('b')
      .where('b.status = :st', { st: 'on' })
      .andWhere('b.deleted_at IS NULL')
      .andWhere('b.rule_type != :manual', { manual: 'manual' })
      .getMany();

    const userBadges = await this.userBadgeRepo.find({
      where: { userId: String(userId) },
    });
    const ownedSet = new Set(userBadges.map((ub) => String(ub.badgeId)));

    const streak = await this.goalService.getStreak(userId);
    const totalBooks = await this.goalService.getTotalBooksRead(userId);
    const reviewCount = await this.getApprovedReviewCount(userId);

    const awarded: { badgeId: number; code: string; name: string }[] = [];

    for (const badge of badges) {
      if (ownedSet.has(String(badge.id))) continue;

      let shouldAward = false;
      switch (badge.ruleType) {
        case 'streak':
          shouldAward = streak.currentStreak >= (badge.ruleValue ?? 0);
          break;
        case 'books':
          shouldAward = totalBooks >= (badge.ruleValue ?? 0);
          break;
        case 'review':
          shouldAward = reviewCount >= (badge.ruleValue ?? 0);
          break;
        case 'goal':
          shouldAward = await this.checkGoalAchieved(userId, badge);
          break;
      }

      if (shouldAward) {
        try {
          await this.userBadgeRepo.insert({
            userId: String(userId),
            badgeId: String(badge.id),
          });
          awarded.push({
            badgeId: Number(badge.id),
            code: badge.code,
            name: badge.name,
          });
          this.logger.log(`用户 ${userId} 解锁徽章: ${badge.code} (${badge.name})`);
        } catch {
          // 唯一键冲突 = 已拥有，忽略
        }
      }
    }

    return { awarded };
  }

  private async checkGoalAchieved(userId: number, badge: Badge): Promise<boolean> {
    const config = badge.ruleConfig as { scope?: string } | null;
    const scope = config?.scope ?? 'yearly';

    const goals = await this.goalService.getGoals(userId);
    const target = goals.find((g) => g.goalType === scope);
    if (!target) return false;

    if (target.status === 'achieved') return true;

    const targetMinutes = target.targetMinutes;
    const targetBooks = target.targetBooks;
    if (targetMinutes > 0 && target.actualMinutes >= targetMinutes) return true;
    if (targetBooks > 0 && target.actualBooks >= targetBooks) return true;
    return false;
  }

  private async getApprovedReviewCount(userId: number): Promise<number> {
    const row = await this.dataSource
      .createQueryBuilder()
      .select('COUNT(*)', 'cnt')
      .from('reviews', 'r')
      .where('r.user_id = :uid', { uid: String(userId) })
      .andWhere('r.audit_status = :st', { st: 'approved' })
      .andWhere('r.deleted_at IS NULL')
      .getRawOne<{ cnt: string }>();
    return Number(row?.cnt ?? 0);
  }

  async awardManualBadge(userId: number, badgeCode: string): Promise<{ awarded: boolean; badgeId: number }> {
    const badge = await this.badgeRepo.findOne({ where: { code: badgeCode } });
    if (!badge) throw new Error('徽章不存在');
    if (badge.ruleType !== 'manual') throw new Error('该徽章不支持手动颁发');

    const existing = await this.userBadgeRepo.findOne({
      where: { userId: String(userId), badgeId: String(badge.id) },
    });
    if (existing) return { awarded: false, badgeId: Number(badge.id) };

    await this.userBadgeRepo.insert({
      userId: String(userId),
      badgeId: String(badge.id),
    });
    this.logger.log(`用户 ${userId} 手动颁发徽章: ${badge.code}`);
    return { awarded: true, badgeId: Number(badge.id) };
  }
}
