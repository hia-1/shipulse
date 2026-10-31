import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { Book } from '../library/entities/book.entity';
import { Review } from '../community/entities/review.entity';
import { Booklist } from '../booklist/entities/booklist.entity';
import { Post } from '../post/entities/post.entity';
import { ReadingSession } from '../reading/entities/reading-session.entity';
import { User } from '../user/entities/user.entity';
import { CreateShareDto, ShareTypeDto } from './dto/share.dto';

export type ShareTemplate = 'pulse' | 'booklist' | 'review';

export interface ShareCardPayload {
  template: ShareTemplate;
  code: string;
  url: string;
  title: string;
  subtitle: string;
  coverUrl: string;
  quote: string;
  rating: number | null;
  author: { nickname: string; avatarUrl: string };
  stats: { label: string; value: string }[];
  footer: string;
}

export interface ShareContent {
  type: ShareTypeDto;
  targetId: number;
  path: string;
  title: string;
  subtitle: string;
  coverUrl: string;
  description: string;
  quote: string;
  rating: number | null;
  images: string[];
  author: { id: number; nickname: string; avatarUrl: string };
  stats: { label: string; value: string }[];
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const FOOTER = '时脉书社 · 阅读世界';

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Injectable()
export class ShareService {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Booklist) private readonly booklistRepo: Repository<Booklist>,
    @InjectRepository(Post) private readonly postRepo: Repository<Post>,
    @InjectRepository(ReadingSession)
    private readonly sessionRepo: Repository<ReadingSession>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  // ---------- 短码 ----------

  private randomCode(len = 8): string {
    let code = '';
    for (let i = 0; i < len; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return code;
  }

  /** 生成全局唯一短码（跨书/书评/书单/动态，防枚举：随机且无规律） */
  private async uniqueCode(): Promise<string> {
    for (let i = 0; i < 20; i++) {
      const code = this.randomCode();
      const [b, r, bl, p] = await Promise.all([
        this.bookRepo.findOne({ where: { shortCode: code }, select: ['id'] }),
        this.reviewRepo.findOne({ where: { shortCode: code }, select: ['id'] }),
        this.booklistRepo.findOne({ where: { shortCode: code }, select: ['id'] }),
        this.postRepo.findOne({ where: { shortCode: code }, select: ['id'] }),
      ]);
      if (!b && !r && !bl && !p) return code;
    }
    throw new Error('短码生成失败，请重试');
  }

  /** 复用实体已有 short_code，缺失则生成并落库（对外链接稳定、防枚举） */
  private async ensureShortCode<
    T extends { id: string; shortCode: string | null },
  >(repo: Repository<T>, entity: T): Promise<string> {
    if (entity.shortCode) return entity.shortCode;
    const code = await this.uniqueCode();
    entity.shortCode = code;
    await repo.save(entity);
    return code;
  }

  private secret(): string {
    return this.config.get<string>('jwt.secret') || 'change_me';
  }

  /**
   * 时脉分享码：无实体承载，改用「用户ID + HMAC 签名」派生。
   * 短码不可伪造、不可枚举，且无需额外存储；同一用户链接稳定。
   */
  private signPulseCode(userId: number): string {
    const sig = createHmac('sha256', this.secret())
      .update(`pulse:${userId}`)
      .digest('base64')
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 8);
    return `p${userId}x${sig}`;
  }

  private verifyPulseCode(code: string): number | null {
    const m = /^p(\d{1,10})x([A-Za-z0-9]{8})$/.exec(code);
    if (!m) return null;
    const userId = Number(m[1]);
    const expected = this.signPulseCode(userId);
    const a = Buffer.from(code);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return null;
    return timingSafeEqual(a, b) ? userId : null;
  }

  // ---------- 生成分享 ----------

  async create(dto: CreateShareDto, userId?: number) {
    const targetId = String(dto.targetId);
    switch (dto.type) {
      case 'book':
        return this.createBookShare(targetId);
      case 'review':
        return this.createReviewShare(targetId);
      case 'booklist':
        return this.createBooklistShare(targetId);
      case 'post':
        return this.createPostShare(targetId);
      case 'pulse':
        return this.createPulseShare(userId);
      default:
        throw new NotFoundException('不支持的分享类型');
    }
  }

  private async createBookShare(id: string) {
    const book = await this.bookRepo.findOne({
      where: { id, status: 'on_shelf' },
    });
    if (!book) throw new NotFoundException('图书不存在或未上架');
    const code = await this.ensureShortCode(this.bookRepo, book);
    const card = this.buildBookCard(book, code);
    return { code, url: `/s/${code}`, card };
  }

  private async createReviewShare(id: string) {
    const review = await this.reviewRepo.findOne({
      where: { id, auditStatus: 'approved' },
    });
    if (!review) throw new NotFoundException('书评不存在或未通过审核');
    const [book, author] = await Promise.all([
      this.bookRepo.findOne({ where: { id: review.bookId } }),
      this.userRepo.findOne({ where: { id: Number(review.userId) } }),
    ]);
    const code = await this.ensureShortCode(this.reviewRepo, review);
    const card = this.buildReviewCard(review, book, author, code);
    return { code, url: `/s/${code}`, card };
  }

  private async createBooklistShare(id: string) {
    const list = await this.booklistRepo.findOne({
      where: { id, auditStatus: 'approved' },
    });
    if (!list) throw new NotFoundException('书单不存在或未通过审核');
    const author = await this.userRepo.findOne({ where: { id: Number(list.userId) } });
    const code = await this.ensureShortCode(this.booklistRepo, list);
    const card = this.buildBooklistCard(list, author, code);
    return { code, url: `/s/${code}`, card };
  }

  private async createPostShare(id: string) {
    const post = await this.postRepo.findOne({
      where: { id, auditStatus: 'approved' },
    });
    if (!post) throw new NotFoundException('动态不存在或未通过审核');
    const author = await this.userRepo.findOne({ where: { id: Number(post.userId) } });
    const code = await this.ensureShortCode(this.postRepo, post);
    const card = this.buildPostCard(post, author, code);
    return { code, url: `/s/${code}`, card };
  }

  private async createPulseShare(userId?: number) {
    if (!userId) throw new ForbiddenException('登录后可生成时脉分享卡片');
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('用户不存在');
    const stats = await this.pulseStats(userId);
    const code = this.signPulseCode(userId);
    const card = this.buildPulseCard(user, stats, code);
    return { code, url: `/s/${code}`, card };
  }

  // ---------- 解析分享 ----------

  async resolve(code: string) {
    if (!/^[A-Za-z0-9]{1,24}$/.test(code)) {
      throw new NotFoundException('分享链接不存在或已失效');
    }

    const pulseUserId = this.verifyPulseCode(code);
    if (pulseUserId) return this.resolvePulse(pulseUserId, code);

    const book = await this.bookRepo.findOne({
      where: { shortCode: code, status: 'on_shelf' },
    });
    if (book) return this.resolveBook(book, code);

    const review = await this.reviewRepo.findOne({
      where: { shortCode: code, auditStatus: 'approved' },
    });
    if (review) return this.resolveReview(review, code);

    const list = await this.booklistRepo.findOne({
      where: { shortCode: code, auditStatus: 'approved' },
    });
    if (list) return this.resolveBooklist(list, code);

    const post = await this.postRepo.findOne({
      where: { shortCode: code, auditStatus: 'approved' },
    });
    if (post) return this.resolvePost(post, code);

    throw new NotFoundException('分享链接不存在或已失效');
  }

  private async resolveBook(book: Book, code: string) {
    const card = this.buildBookCard(book, code);
    const content: ShareContent = {
      type: 'book',
      targetId: Number(book.id),
      path: `/books/${book.id}`,
      title: book.title,
      subtitle: book.author,
      coverUrl: book.coverUrl,
      description: book.description ?? '',
      quote: (book.description ?? '').slice(0, 80),
      rating: Number(book.ratingAvg) || null,
      images: [],
      author: { id: 0, nickname: book.author, avatarUrl: '' },
      stats: [],
    };
    return { card, content };
  }

  private async resolveReview(review: Review, code: string) {
    const [book, author] = await Promise.all([
      this.bookRepo.findOne({ where: { id: review.bookId } }),
      this.userRepo.findOne({ where: { id: Number(review.userId) } }),
    ]);
    const card = this.buildReviewCard(review, book, author, code);
    const content: ShareContent = {
      type: 'review',
      targetId: Number(review.id),
      path: `/reviews/${review.id}`,
      title: review.title || (book?.title ?? '书评'),
      subtitle: book?.title ?? '',
      coverUrl: book?.coverUrl ?? '',
      description: review.content ?? '',
      quote: (review.content ?? '').slice(0, 80),
      rating: Number(review.rating) || null,
      images: [],
      author: this.authorOf(author),
      stats: [],
    };
    return { card, content };
  }

  private async resolveBooklist(list: Booklist, code: string) {
    const author = await this.userRepo.findOne({ where: { id: Number(list.userId) } });
    const card = this.buildBooklistCard(list, author, code);
    const content: ShareContent = {
      type: 'booklist',
      targetId: Number(list.id),
      path: `/booklists/${list.id}`,
      title: list.title,
      subtitle: list.description,
      coverUrl: list.coverUrl,
      description: list.description,
      quote: list.description.slice(0, 80),
      rating: null,
      images: [],
      author: this.authorOf(author),
      stats: [
        { label: '收录书籍', value: `${list.itemCount} 本` },
        { label: '收藏', value: `${list.collectCount}` },
      ],
    };
    return { card, content };
  }

  private async resolvePost(post: Post, code: string) {
    const author = await this.userRepo.findOne({ where: { id: Number(post.userId) } });
    const card = this.buildPostCard(post, author, code);
    const content: ShareContent = {
      type: 'post',
      targetId: Number(post.id),
      path: '/feed',
      title: author?.nickname ?? '读者动态',
      subtitle: '',
      coverUrl: post.images?.[0] ?? '',
      description: post.content,
      quote: post.content.slice(0, 80),
      rating: null,
      images: post.images ?? [],
      author: this.authorOf(author),
      stats: post.readMinutes
        ? [{ label: '阅读时长', value: `${post.readMinutes} 分钟` }]
        : [],
    };
    return { card, content };
  }

  private async resolvePulse(userId: number, code: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('分享链接不存在或已失效');
    const stats = await this.pulseStats(userId);
    const card = this.buildPulseCard(user, stats, code);
    const content: ShareContent = {
      type: 'pulse',
      targetId: userId,
      path: '/',
      title: `${user.nickname || '读者'} 的 ${stats.year} 时脉`,
      subtitle: '阅读世界 · 记录时光',
      coverUrl: user.avatarUrl,
      description: `在时脉书社，${user.nickname || 'TA'} 今年共阅读 ${stats.totalSeconds}，涉猎 ${stats.bookCount} 本书。`,
      quote: '',
      rating: null,
      images: [],
      author: { id: user.id, nickname: user.nickname, avatarUrl: user.avatarUrl },
      stats: this.pulseStatsRows(stats),
    };
    return { card, content };
  }

  // ---------- 卡片构造 ----------

  private authorOf(user: User | null) {
    return {
      id: user ? user.id : 0,
      nickname: user?.nickname ?? '读者',
      avatarUrl: user?.avatarUrl ?? '',
    };
  }

  private buildBookCard(book: Book, code: string): ShareCardPayload {
    return {
      template: 'review',
      code,
      url: `/s/${code}`,
      title: book.title,
      subtitle: book.author,
      coverUrl: book.coverUrl,
      quote: (book.description ?? '').slice(0, 80),
      rating: Number(book.ratingAvg) || null,
      author: { nickname: book.author, avatarUrl: '' },
      stats: [],
      footer: FOOTER,
    };
  }

  private buildReviewCard(
    review: Review,
    book: Book | null,
    author: User | null,
    code: string,
  ): ShareCardPayload {
    return {
      template: 'review',
      code,
      url: `/s/${code}`,
      title: book?.title ?? '书评',
      subtitle: review.title,
      coverUrl: book?.coverUrl ?? '',
      quote: (review.content ?? '').slice(0, 80),
      rating: Number(review.rating) || null,
      author: { nickname: author?.nickname ?? '读者', avatarUrl: author?.avatarUrl ?? '' },
      stats: [],
      footer: FOOTER,
    };
  }

  private buildBooklistCard(
    list: Booklist,
    author: User | null,
    code: string,
  ): ShareCardPayload {
    return {
      template: 'booklist',
      code,
      url: `/s/${code}`,
      title: list.title,
      subtitle: list.description.slice(0, 40),
      coverUrl: list.coverUrl,
      quote: '',
      rating: null,
      author: { nickname: author?.nickname ?? '读者', avatarUrl: author?.avatarUrl ?? '' },
      stats: [
        { label: '收录书籍', value: `${list.itemCount} 本` },
        { label: '收藏', value: `${list.collectCount}` },
      ],
      footer: FOOTER,
    };
  }

  private buildPostCard(post: Post, author: User | null, code: string): ShareCardPayload {
    return {
      template: 'review',
      code,
      url: `/s/${code}`,
      title: author?.nickname ?? '读者动态',
      subtitle: '',
      coverUrl: post.images?.[0] ?? '',
      quote: post.content.slice(0, 80),
      rating: null,
      author: { nickname: author?.nickname ?? '读者', avatarUrl: author?.avatarUrl ?? '' },
      stats: [],
      footer: FOOTER,
    };
  }

  private buildPulseCard(
    user: User,
    stats: PulseStats,
    code: string,
  ): ShareCardPayload {
    return {
      template: 'pulse',
      code,
      url: `/s/${code}`,
      title: `${user.nickname || '读者'} 的 ${stats.year} 时脉`,
      subtitle: '阅读世界 · 记录时光',
      coverUrl: user.avatarUrl,
      quote: '',
      rating: null,
      author: { nickname: user.nickname, avatarUrl: user.avatarUrl },
      stats: this.pulseStatsRows(stats),
      footer: FOOTER,
    };
  }

  private pulseStatsRows(stats: PulseStats) {
    return [
      { label: '阅读时长', value: stats.totalSeconds },
      { label: '阅读场次', value: `${stats.sessionCount} 次` },
      { label: '涉猎书籍', value: `${stats.bookCount} 本` },
      { label: '最长连续', value: `${stats.longestStreak} 天` },
    ];
  }

  // ---------- 时脉统计 ----------

  private async pulseStats(userId: number): Promise<PulseStats> {
    const year = new Date().getFullYear();
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

    const daily = (await this.sessionRepo
      .createQueryBuilder('s')
      .select("DATE_FORMAT(s.start_time, '%Y-%m-%d')", 'date')
      .addSelect('COALESCE(SUM(s.duration_seconds), 0)', 'seconds')
      .where('s.user_id = :uid', { uid })
      .andWhere('s.start_time >= :start', { start })
      .andWhere('s.start_time < :end', { end })
      .andWhere('s.status = :status', { status: 'finished' })
      .groupBy("DATE_FORMAT(s.start_time, '%Y-%m-%d')")
      .getRawMany()) as { date: string; seconds: string }[];

    const today = localDateStr(new Date());
    let longest = 0;
    let temp = 0;
    const active = new Set(daily.filter((d) => Number(d.seconds) > 0).map((d) => String(d.date).slice(0, 10)));
    const cursor = new Date(start);
    while (cursor < end) {
      const key = localDateStr(cursor);
      if (key > today) break;
      if (active.has(key)) {
        temp += 1;
        longest = Math.max(longest, temp);
      } else {
        temp = 0;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    const totalSecondsNum = Number(raw?.totalSeconds || 0);
    return {
      year,
      totalSeconds: this.formatDuration(totalSecondsNum),
      sessionCount: Number(raw?.sessionCount || 0),
      bookCount: Number(raw?.bookCount || 0),
      longestStreak: longest,
    };
  }

  private formatDuration(seconds: number): string {
    if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟`;
    return `${(seconds / 3600).toFixed(1)} 小时`;
  }
}

interface PulseStats {
  year: number;
  totalSeconds: string;
  sessionCount: number;
  bookCount: number;
  longestStreak: number;
}
