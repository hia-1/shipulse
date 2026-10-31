import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Banner } from './entities/banner.entity';
import { ColumnItem } from './entities/column.entity';
import { Review } from '../community/entities/review.entity';
import { User } from '../user/entities/user.entity';
import { BooksService } from '../library/books.service';
import { RankService, type RankType } from './rank.service';

export interface DiscoverPayload {
  banners: Array<{
    id: number;
    title: string;
    imageUrl: string;
    linkType: string;
    linkValue: string;
  }>;
  weeklyBooks: Array<{ id: number; title: string; subtitle: string; coverUrl: string; book: Record<string, unknown> | null }>;
  rankEntries: Array<{ key: RankType; name: string; books: Record<string, unknown>[] }>;
  hotReviews: Array<{
    id: number;
    bookId: number;
    bookTitle: string;
    coverUrl: string;
    rating: number;
    title: string;
    contentPreview: string;
    likeCount: number;
    commentCount: number;
    publishedAt: string | null;
    author: { nickname: string; isMember: boolean };
  }>;
}

const RANK_META: Array<{ key: RankType; name: string }> = [
  { key: 'hot', name: '热门榜' },
  { key: 'new', name: '新书榜' },
  { key: 'rating', name: '高分榜' },
];

@Injectable()
export class HomeService {
  constructor(
    @InjectRepository(Banner)
    private readonly bannerRepo: Repository<Banner>,
    @InjectRepository(ColumnItem)
    private readonly columnRepo: Repository<ColumnItem>,
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly booksService: BooksService,
    private readonly rankService: RankService,
  ) {}

  /** 首页（发现式）聚合：Banner / 每周好书 / 榜单 / 热门书评 */
  async discover(): Promise<DiscoverPayload> {
    const now = new Date();
    const [banners, weeklyBooks, rankEntries, hotReviews] = await Promise.all([
      this.getBanners(now),
      this.getWeeklyBooks(now),
      this.loadRankEntries(),
      this.getHotReviews(),
    ]);
    return { banners, weeklyBooks, rankEntries, hotReviews };
  }

  /** 指定榜单书籍列表 */
  async rank(type: RankType, limit: number) {
    const books = await this.loadRankBooks(type, limit);
    return { type, list: books };
  }

  // ---- 板块 ----

  private async getBanners(now: Date) {
    const rows = await this.bannerRepo
      .createQueryBuilder('bn')
      .where('bn.position = :pos', { pos: 'home_top' })
      .andWhere('bn.status = :st', { st: 'on' })
      .andWhere('(bn.start_time IS NULL OR bn.start_time <= :now)', { now })
      .andWhere('(bn.end_time IS NULL OR bn.end_time >= :now)', { now })
      .orderBy('bn.sort', 'ASC')
      .addOrderBy('bn.id', 'DESC')
      .take(6)
      .getMany();
    return rows.map((b) => ({
      id: Number(b.id),
      title: b.title,
      imageUrl: b.imageUrl,
      linkType: b.linkType,
      linkValue: b.linkValue,
    }));
  }

  private async getWeeklyBooks(now: Date) {
    const cols = await this.columnRepo
      .createQueryBuilder('c')
      .where('c.type = :type', { type: 'weekly_pick' })
      .andWhere('c.status = :st', { st: 'on' })
      .andWhere('(c.published_at IS NULL OR c.published_at <= :now)', { now })
      .orderBy('c.sort', 'ASC')
      .addOrderBy('c.published_at', 'DESC')
      .take(6)
      .getMany();

    const withBook = cols.filter((c) => c.bookId);
    const books = new Map(
      (await this.booksService.findMany(withBook.map((c) => String(c.bookId!)))).map(
        (b) => [String((b as unknown as { id: number }).id), b],
      ),
    );

    return cols.map((c) => {
      const book = c.bookId ? books.get(String(c.bookId)) || null : null;
      return {
        id: Number(c.id),
        title: c.title,
        subtitle: c.subtitle,
        coverUrl: book ? (book as unknown as { coverUrl: string }).coverUrl : c.coverUrl,
        book,
      };
    });
  }

  private async loadRankEntries() {
    return Promise.all(
      RANK_META.map(async ({ key, name }) => ({
        key,
        name,
        books: await this.loadRankBooks(key, 5),
      })),
    );
  }

  private async loadRankBooks(type: RankType, limit: number) {
    const entries = await this.rankService.getRankIds(type, limit);
    if (entries.length === 0) return [];
    const rows = await this.booksService.findMany(entries.map((e) => e.bookId));
    const byId = new Map(
      rows.map((b) => [String((b as unknown as { id: number }).id), b]),
    );
    // 保持榜单名次顺序，筛掉已下架/缺行
    return entries
      .map((e) => byId.get(e.bookId))
      .filter((b): b is Record<string, unknown> => !!b);
  }

  private async getHotReviews() {
    const rows = await this.reviewRepo
      .createQueryBuilder('r')
      .select([
        'r.id AS r_id',
        'r.book_id AS r_book_id',
        'r.rating AS r_rating',
        'r.title AS r_title',
        'r.content AS r_content',
        'r.like_count AS r_like_count',
        'r.comment_count AS r_comment_count',
        'r.published_at AS r_published_at',
        'r.user_id AS r_user_id',
        'r.is_featured AS r_is_featured',
      ])
      .where('r.audit_status = :st', { st: 'approved' })
      .andWhere('r.deleted_at IS NULL')
      .orderBy('r.is_featured', 'DESC')
      .addOrderBy('r.like_count', 'DESC')
      .addOrderBy('r.published_at', 'DESC')
      .take(6)
      .getRawMany<{
        r_id: string;
        r_book_id: string;
        r_rating: string;
        r_title: string;
        r_content: string | null;
        r_like_count: string;
        r_comment_count: string;
        r_published_at: Date | null;
        r_user_id: string;
        r_is_featured: number;
      }>();

    const users = await this.userRepo.find({
      where: { id: In([...new Set(rows.map((r) => Number(r.r_user_id)))]) },
    });
    const userMap = new Map(users.map((u) => [Number(u.id), u]));
    const books = new Map(
      (await this.booksService.findMany([...new Set(rows.map((r) => String(r.r_book_id)))])).map(
        (b) => [String((b as unknown as { id: number }).id), b],
      ),
    );

    return rows.map((r) => {
      const book = books.get(String(r.r_book_id));
      const u = userMap.get(Number(r.r_user_id));
      return {
        id: Number(r.r_id),
        bookId: Number(r.r_book_id),
        bookTitle: (book as unknown as { title?: string })?.title ?? '书籍已下架',
        coverUrl: (book as unknown as { coverUrl?: string })?.coverUrl ?? '',
        rating: Number(r.r_rating) || 0,
        title: r.r_title,
        contentPreview: (r.r_content ?? '').slice(0, 120),
        likeCount: Number(r.r_like_count) || 0,
        commentCount: Number(r.r_comment_count) || 0,
        isFeatured: !!r.r_is_featured,
        publishedAt: r.r_published_at ? r.r_published_at.toISOString() : null,
        author: { nickname: u?.nickname ?? '已注销用户', isMember: !!u?.isMember },
      };
    });
  }
}