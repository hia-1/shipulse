import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ReadingGoal } from './entities/reading-goal.entity';
import { ReadingSession } from '../reading/entities/reading-session.entity';
import { CreateGoalDto } from './dto/create-goal.dto';

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface GoalProgress {
  id: number;
  goalType: 'yearly' | 'monthly';
  period: string;
  targetMinutes: number;
  targetBooks: number;
  actualMinutes: number;
  actualBooks: number;
  status: string;
  minuteProgress: number;
  bookProgress: number;
  achieved: boolean;
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
}

@Injectable()
export class GoalService {
  constructor(
    @InjectRepository(ReadingGoal)
    private readonly goalRepo: Repository<ReadingGoal>,
    @InjectRepository(ReadingSession)
    private readonly sessionRepo: Repository<ReadingSession>,
    private readonly dataSource: DataSource,
  ) {}

  private currentPeriod(goalType: 'yearly' | 'monthly'): string {
    const now = new Date();
    if (goalType === 'yearly') return String(now.getFullYear());
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private periodRange(period: string, goalType: string): { start: Date; end: Date } {
    if (goalType === 'yearly') {
      const year = Number(period);
      return {
        start: new Date(year, 0, 1),
        end: new Date(year + 1, 0, 1),
      };
    }
    const [y, m] = period.split('-').map(Number);
    return {
      start: new Date(y, m - 1, 1),
      end: new Date(y, m, 1),
    };
  }

  async getGoals(userId: number): Promise<ReadingGoal[]> {
    const now = new Date();
    const yearlyPeriod = String(now.getFullYear());
    const monthlyPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return this.goalRepo
      .createQueryBuilder('g')
      .where('g.user_id = :uid', { uid: String(userId) })
      .andWhere('g.deleted_at IS NULL')
      .andWhere(
        '(g.goal_type = :yearly AND g.period = :yPeriod) OR (g.goal_type = :monthly AND g.period = :mPeriod)',
        { yearly: 'yearly', yPeriod: yearlyPeriod, monthly: 'monthly', mPeriod: monthlyPeriod },
      )
      .orderBy('g.goal_type', 'ASC')
      .getMany();
  }

  async createGoal(userId: number, dto: CreateGoalDto): Promise<ReadingGoal> {
    const period = dto.period || this.currentPeriod(dto.goalType);
    const existing = await this.goalRepo.findOne({
      where: { userId: String(userId), goalType: dto.goalType, period },
    });
    if (existing) throw new ConflictException('该周期已存在阅读目标');

    const goal = this.goalRepo.create({
      userId: String(userId),
      goalType: dto.goalType,
      period,
      targetMinutes: dto.targetMinutes ?? 0,
      targetBooks: dto.targetBooks ?? 0,
      actualMinutes: 0,
      actualBooks: 0,
      status: 'active',
    });
    const saved = await this.goalRepo.save(goal);
    await this.refreshProgress(userId, Number(saved.id));
    return saved;
  }

  async updateGoal(userId: number, goalId: number, updates: { targetMinutes?: number; targetBooks?: number }): Promise<ReadingGoal> {
    const goal = await this.goalRepo.findOne({
      where: { id: String(goalId), userId: String(userId) },
    });
    if (!goal) throw new NotFoundException('目标不存在');
    if (updates.targetMinutes !== undefined) goal.targetMinutes = updates.targetMinutes;
    if (updates.targetBooks !== undefined) goal.targetBooks = updates.targetBooks;
    return this.goalRepo.save(goal);
  }

  async getProgress(userId: number): Promise<GoalProgress[]> {
    const goals = await this.getGoals(userId);
    if (goals.length === 0) return [];

    const results: GoalProgress[] = [];
    for (const goal of goals) {
      await this.refreshProgress(userId, Number(goal.id));
    }

    const refreshed = await this.goalRepo
      .createQueryBuilder('g')
      .where('g.user_id = :uid', { uid: String(userId) })
      .andWhere('g.deleted_at IS NULL')
      .andWhere('g.id IN (:...ids)', { ids: goals.map((g) => g.id) })
      .getMany();

    for (const goal of refreshed) {
      const minuteProgress = goal.targetMinutes > 0 ? Math.min(1, goal.actualMinutes / goal.targetMinutes) : 0;
      const bookProgress = goal.targetBooks > 0 ? Math.min(1, goal.actualBooks / goal.targetBooks) : 0;
      const achieved = (goal.targetMinutes > 0 && goal.actualMinutes >= goal.targetMinutes) ||
        (goal.targetBooks > 0 && goal.actualBooks >= goal.targetBooks);

      if (achieved && goal.status === 'active') {
        goal.status = 'achieved';
        await this.goalRepo.save(goal);
      }

      results.push({
        id: Number(goal.id),
        goalType: goal.goalType as 'yearly' | 'monthly',
        period: goal.period,
        targetMinutes: goal.targetMinutes,
        targetBooks: goal.targetBooks,
        actualMinutes: goal.actualMinutes,
        actualBooks: goal.actualBooks,
        status: goal.status,
        minuteProgress,
        bookProgress,
        achieved,
      });
    }
    return results;
  }

  async refreshProgress(userId: number, goalId?: number): Promise<void> {
    const goals = goalId
      ? [await this.goalRepo.findOne({ where: { id: String(goalId) } })].filter(Boolean) as ReadingGoal[]
      : await this.getGoals(userId);

    for (const goal of goals) {
      const { start, end } = this.periodRange(goal.period, goal.goalType);

      const minuteRow = await this.sessionRepo
        .createQueryBuilder('s')
        .select('COALESCE(SUM(s.duration_seconds), 0)', 'totalSeconds')
        .where('s.user_id = :uid', { uid: String(userId) })
        .andWhere('s.status = :st', { st: 'finished' })
        .andWhere('s.deleted_at IS NULL')
        .andWhere('s.start_time >= :start AND s.start_time < :end', { start, end })
        .getRawOne<{ totalSeconds: string }>();

      const bookRow = await this.sessionRepo
        .createQueryBuilder('s')
        .select('COUNT(DISTINCT s.book_id)', 'cnt')
        .where('s.user_id = :uid', { uid: String(userId) })
        .andWhere('s.status = :st', { st: 'finished' })
        .andWhere('s.deleted_at IS NULL')
        .andWhere('s.start_time >= :start AND s.start_time < :end', { start, end })
        .getRawOne<{ cnt: string }>();

      goal.actualMinutes = Math.floor(Number(minuteRow?.totalSeconds ?? 0) / 60);
      goal.actualBooks = Number(bookRow?.cnt ?? 0);

      if (goal.status === 'active') {
        if ((goal.targetMinutes > 0 && goal.actualMinutes >= goal.targetMinutes) ||
          (goal.targetBooks > 0 && goal.actualBooks >= goal.targetBooks)) {
          goal.status = 'achieved';
        }
      }

      await this.goalRepo.save(goal);
    }
  }

  async getStreak(userId: number): Promise<StreakInfo> {
    const today = new Date();
    const start = new Date(today.getFullYear(), 0, 1);
    const end = new Date(today.getFullYear() + 1, 0, 1);

    const daily = await this.sessionRepo
      .createQueryBuilder('s')
      .select("DATE_FORMAT(s.start_time, '%Y-%m-%d')", 'date')
      .addSelect('COALESCE(SUM(s.duration_seconds), 0)', 'seconds')
      .where('s.user_id = :uid', { uid: String(userId) })
      .andWhere('s.status = :st', { st: 'finished' })
      .andWhere('s.deleted_at IS NULL')
      .andWhere('s.start_time >= :start AND s.start_time < :end', { start, end })
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany<{ date: string; seconds: string }>();

    const dayMap = new Set<string>();
    for (const d of daily) {
      if (Number(d.seconds) > 0) dayMap.add(d.date);
    }

    const todayStr = localDateStr(today);
    let current = 0;
    let longest = 0;
    let temp = 0;

    const cursor = new Date(start);
    while (cursor < end) {
      const dateStr = localDateStr(cursor);
      if (dayMap.has(dateStr)) {
        temp++;
        longest = Math.max(longest, temp);
      } else {
        if (dateStr <= todayStr) temp = 0;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    current = temp;

    return { currentStreak: current, longestStreak: longest };
  }

  async getTotalBooksRead(userId: number): Promise<number> {
    const row = await this.sessionRepo
      .createQueryBuilder('s')
      .select('COUNT(DISTINCT s.book_id)', 'cnt')
      .where('s.user_id = :uid', { uid: String(userId) })
      .andWhere('s.status = :st', { st: 'finished' })
      .andWhere('s.deleted_at IS NULL')
      .getRawOne<{ cnt: string }>();
    return Number(row?.cnt ?? 0);
  }
}
