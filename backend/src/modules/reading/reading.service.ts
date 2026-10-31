import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReadingSession } from './entities/reading-session.entity';
import { BookshelfService } from './bookshelf.service';
import { BooksService } from '../library/books.service';
import { MembershipService } from '../membership/membership.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { FinishSessionDto } from './dto/finish-session.dto';

/** 转义 CSV 字段：以 = + - @ 开头的值加前导单引号，并用双引号包裹避免公式注入/结构破坏 */
function csvEscape(v: unknown): string {
  let s = String(v ?? '');
  // 去首尾空白后判断公式前缀，命中则加前导单引号打断
  if (/^[=+\-@]/.test(s.trim())) {
    s = `'${s}`;
  }
  // 双引号包裹可同时转义逗号/换行/引号（内部双引号翻倍）
  return `"${s.replace(/"/g, '""')}"`;
}

export interface SessionSummary {
  sessionId: number;
  bookId: number;
  bookTitle: string;
  coverUrl: string;
  startTime: string;
  endTime: string | null;
  durationSeconds: number;
  startPage: number;
  endPage: number;
  note: string;
  status: string;
}

export interface TodaySummary {
  totalSeconds: number;
  sessionCount: number;
  bookCount: number;
}

export interface DailyDuration {
  date: string;
  seconds: number;
  sessionCount: number;
}

/** 本地时区格式化日期为 YYYY-MM-DD（避免 toISOString 的 UTC 偏移导致日期 key 错位） */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface AnnualReview {
  totalSeconds: number;
  sessionCount: number;
  bookCount: number;
  finishedBookCount: number;
  longestStreak: number;
  currentStreak: number;
}

/**
 * 阅读场次：手动开始/结束计时，时长=结束-开始（扣除暂停）。
 * 计时数据沉淀为时脉报告数据源（P1-06）。
 */
@Injectable()
export class ReadingService {
  constructor(
    @InjectRepository(ReadingSession)
    private readonly sessionRepo: Repository<ReadingSession>,
    private readonly bookshelfService: BookshelfService,
    private readonly booksService: BooksService,
    private readonly membershipService: MembershipService,
  ) {}

  ping() {
    return { module: 'reading', status: 'active' };
  }

  /** 开始阅读场次：创建一条 ongoing 记录，自动结束之前未完成的场次 */
  async createSession(userId: number, dto: CreateSessionDto) {
    const uid = String(userId);
    const bookIdStr = String(dto.bookId);

    // 验证书籍存在
    const book = await this.booksService.findBookOnShelf(bookIdStr);
    if (!book) throw new NotFoundException('书籍不存在或未上架');

    // 自动结束进行中的场次
    const ongoing = await this.sessionRepo.findOne({
      where: { userId: uid, status: 'ongoing' },
    });
    if (ongoing) {
      await this.doFinish(ongoing, { endPage: 0, note: '', durationSeconds: undefined });
    }

    // 关联书架记录
    const shelf = await this.bookshelfService.findByUserBook(userId, bookIdStr);

    const session = this.sessionRepo.create({
      userId: uid,
      bookId: bookIdStr,
      bookshelfId: shelf ? String(shelf.id) : null,
      startTime: new Date(),
      startPage: dto.startPage ?? 0,
      source: dto.source ?? 'web',
      status: 'ongoing',
    });
    await this.sessionRepo.save(session);

    return this.toSummary(session, book);
  }

  /** 结束阅读场次：填写页码/笔记，计算时长，更新书架进度 */
  async finishSession(userId: number, sessionId: number, dto: FinishSessionDto) {
    const session = await this.sessionRepo.findOne({
      where: { id: String(sessionId), userId: String(userId) },
    });
    if (!session) throw new NotFoundException('阅读场次不存在');
    if (session.status === 'finished') throw new NotFoundException('该场次已结束');

    const result = await this.doFinish(session, dto);

    // 更新书架进度
    if (session.bookshelfId) {
      try {
        const book = await this.booksService.findBookOnShelf(session.bookId);
        const pages = book ? Number(book.pages) || 0 : 0;
        const progress = pages > 0 && dto.endPage
          ? Math.min(100, Math.round((dto.endPage / pages) * 100))
          : 0;
        await this.bookshelfService.updateProgress(
          userId,
          session.bookId,
          dto.endPage ?? 0,
          progress,
        );
      } catch {
        /* 书架可能已被移除，忽略进度更新失败 */
      }
    }

    return result;
  }

  /** 获取当前进行中的场次（页面刷新后恢复计时用） */
  async getOngoingSession(userId: number) {
    const session = await this.sessionRepo.findOne({
      where: { userId: String(userId), status: 'ongoing' },
      order: { startTime: 'DESC' },
    });
    if (!session) return null;
    const book = await this.booksService.findBookOnShelf(session.bookId);
    return this.toSummary(session, book ?? undefined);
  }

  /** 今日阅读概览 */
  async getTodaySummary(userId: number): Promise<TodaySummary> {
    const uid = String(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const qb = this.sessionRepo
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.duration_seconds), 0)', 'totalSeconds')
      .addSelect('COUNT(*)', 'sessionCount')
      .addSelect('COUNT(DISTINCT s.book_id)', 'bookCount')
      .where('s.user_id = :uid', { uid })
      .andWhere('s.start_time >= :today', { today })
      .andWhere('s.start_time < :tomorrow', { tomorrow });

    const raw = (await qb.getRawMany())[0] as {
      totalSeconds: string;
      sessionCount: string;
      bookCount: string;
    };

    return {
      totalSeconds: Number(raw?.totalSeconds || 0),
      sessionCount: Number(raw?.sessionCount || 0),
      bookCount: Number(raw?.bookCount || 0),
    };
  }

  /** 按日聚合阅读时长（时脉热力图/折线图数据源） */
  async getDailyDurations(
    userId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<DailyDuration[]> {
    const uid = String(userId);
    const rows = (await this.sessionRepo
      .createQueryBuilder('s')
      .select("DATE_FORMAT(s.start_time, '%Y-%m-%d')", 'date')
      .addSelect('COALESCE(SUM(s.duration_seconds), 0)', 'seconds')
      .addSelect('COUNT(*)', 'count')
      .where('s.user_id = :uid', { uid })
      .andWhere('s.start_time >= :start', { start: startDate })
      .andWhere('s.start_time < :end', { end: endDate })
      .andWhere('s.status = :status', { status: 'finished' })
      .groupBy("DATE_FORMAT(s.start_time, '%Y-%m-%d')")
      .getRawMany()) as { date: string; seconds: string; count: string }[];

    const map = new Map<string, DailyDuration>();
    for (const r of rows) {
      // 兼容驱动对 DATE 列的反序列化：尽可能规整为 YYYY-MM-DD
      const key = String(r.date).slice(0, 10);
      map.set(key, {
        date: key,
        seconds: Number(r.seconds),
        sessionCount: Number(r.count),
      });
    }

    const result: DailyDuration[] = [];
    const cursor = new Date(startDate);
    while (cursor < endDate) {
      const dateStr = localDateStr(cursor);
      result.push(
        map.get(dateStr) ?? { date: dateStr, seconds: 0, sessionCount: 0 },
      );
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }

  /** 年度盘点 */
  async getAnnualReview(userId: number, year: number): Promise<AnnualReview> {
    const uid = String(userId);
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);

    const raw = (await this.sessionRepo
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.duration_seconds), 0)', 'totalSeconds')
      .addSelect('COUNT(*)', 'sessionCount')
      .addSelect('COUNT(DISTINCT s.book_id)', 'bookCount')
      .where('s.user_id = :uid', { uid })
      .andWhere('s.start_time >= :start', { start })
      .andWhere('s.start_time < :end', { end })
      .andWhere('s.status = :status', { status: 'finished' })
      .getRawOne()) as {
      totalSeconds: string;
      sessionCount: string;
      bookCount: string;
    };

    const daily = await this.getDailyDurations(userId, start, end);
    const finishedBookCount = await this.bookshelfService.countFinishedInRange(userId, start, end);
    let longest = 0;
    let current = 0;
    let temp = 0;
    const today = localDateStr(new Date());
    for (const d of daily) {
      if (d.seconds > 0) {
        temp++;
        longest = Math.max(longest, temp);
      } else {
        if (d.date <= today) temp = 0;
      }
    }
    current = temp;

    return {
      totalSeconds: Number(raw?.totalSeconds || 0),
      sessionCount: Number(raw?.sessionCount || 0),
      bookCount: Number(raw?.bookCount || 0),
      finishedBookCount,
      longestStreak: longest,
      currentStreak: current,
    };
  }

  /** 导出阅读场次 CSV（会员功能，权益门控） */
  async exportSessionsCsv(userId: number): Promise<string> {
    const benefit = await this.membershipService.checkBenefit(userId);
    if (!benefit.enabled) {
      throw new ForbiddenException('数据导出为会员专属权益，请开通会员后使用');
    }
    const uid = String(userId);
    const rows = await this.sessionRepo
      .createQueryBuilder('s')
      .where('s.user_id = :uid', { uid })
      .andWhere('s.status = :status', { status: 'finished' })
      .orderBy('s.start_time', 'DESC')
      .getMany();

    const header = '日期,开始时间,结束时间,时长(秒),起始页,结束页,笔记,书ID\n';
    const body = rows
      .map((s) => {
        const date = localDateStr(s.startTime);
        const start = s.startTime.toTimeString().slice(0, 8);
        const end = s.endTime ? s.endTime.toTimeString().slice(0, 8) : '';
        return [
          date,
          start,
          end,
          s.durationSeconds,
          s.startPage,
          s.endPage,
          csvEscape(s.note),
          s.bookId,
        ].join(',');
      })
      .join('\n');
    return header + body;
  }

  /** 查询我的阅读场次列表 */
  async listSessions(userId: number, page = 1, pageSize = 20) {
    const take = Math.min(Math.max(1, pageSize), 50);
    const [rows, total] = await this.sessionRepo
      .createQueryBuilder('s')
      .where('s.user_id = :uid', { uid: String(userId) })
      .orderBy('s.start_time', 'DESC')
      .skip((page - 1) * take)
      .take(take)
      .getManyAndCount();

    const bookIds = [...new Set(rows.map((r) => r.bookId))];
    const books = await this.booksService.findMany(bookIds);
    const bookMap = new Map(books.map((b) => [String(b.id), b]));

    const list = rows.map((s) =>
      this.toSummary(s, bookMap.get(String(s.bookId)) as Record<string, unknown> | undefined),
    );
    return { list, total, page, pageSize: take };
  }

  /** 内部：结束场次的实际逻辑（条件更新，保证 ongoing→finished 只生效一次） */
  private async doFinish(session: ReadingSession, dto: FinishSessionDto) {
    const endTime = new Date();
    const endPage = dto.endPage ?? 0;
    const note = dto.note ?? '';
    const durationSeconds =
      dto.durationSeconds != null
        ? Math.max(0, Math.floor(dto.durationSeconds))
        : Math.max(0, Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000));

    // 仅当仍为 ongoing 时才结束：并发下只有一次更新生效，避免重复结算
    await this.sessionRepo.update(
      { id: session.id, status: 'ongoing' },
      { endTime, status: 'finished', endPage, note, durationSeconds },
    );

    const fresh = await this.sessionRepo.findOne({ where: { id: String(session.id) } });
    const book = await this.booksService.findBookOnShelf(session.bookId);
    return this.toSummary(fresh ?? session, book ?? undefined);
  }

  /** 转换为对外摘要 */
  private toSummary(s: ReadingSession, book?: unknown): SessionSummary {
    const b = (book ?? undefined) as Record<string, unknown> | undefined;
    return {
      sessionId: Number(s.id),
      bookId: Number(s.bookId),
      bookTitle: (b?.title as string) ?? '书籍已下架',
      coverUrl: (b?.coverUrl as string) ?? '',
      startTime: s.startTime.toISOString(),
      endTime: s.endTime ? s.endTime.toISOString() : null,
      durationSeconds: s.durationSeconds,
      startPage: s.startPage,
      endPage: s.endPage,
      note: s.note,
      status: s.status,
    };
  }
}
