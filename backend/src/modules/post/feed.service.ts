import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { Review } from '../community/entities/review.entity';
import { Booklist } from '../booklist/entities/booklist.entity';
import { Like } from '../community/entities/like.entity';
import { User } from '../user/entities/user.entity';
import { Topic } from '../home/entities/topic.entity';
import { BooksService } from '../library/books.service';

export type FeedKind = 'all' | 'checkin' | 'text' | 'review' | 'booklist';
export type FeedSort = 'hot' | 'latest';

export interface FeedItem {
  kind: 'checkin' | 'text' | 'review' | 'booklist';
  id: number;
  author: { id: number; nickname: string; avatarUrl: string; isMember: boolean };
  publishedAt: string | null;
  title?: string;
  content?: string;
  rating?: number;
  readMinutes?: number;
  images?: string[];
  location?: string;
  book?: { id: number; title: string; coverUrl: string } | null;
  itemCount?: number;
  isOfficial?: boolean;
  collectCount?: number;
  topicId?: number | null;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
}

export const FEED_TABS: { value: FeedKind; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'checkin', label: '打卡' },
  { value: 'text', label: '图文' },
  { value: 'review', label: '书评' },
  { value: 'booklist', label: '书单' },
];

/**
 * 动态流（P2-02）：聚合 打卡/图文动态 + 书评 + 书单。
 * 排序指标跨源可比：hot = 点赞+评论（书单=收藏数）；latest = 发布时间。
 * 分页用偏移游标：每源取 offset+pageSize 条按全局指标排序后合并切片，保证合并序列正确。
 */
@Injectable()
export class FeedService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Booklist)
    private readonly blRepo: Repository<Booklist>,
    @InjectRepository(Like)
    private readonly likeRepo: Repository<Like>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Topic)
    private readonly topicRepo: Repository<Topic>,
    private readonly booksService: BooksService,
  ) {}

  /** 活跃话题（供动态流筛选 chips）：仅上线话题，按排序 */
  async topics() {
    const rows = await this.topicRepo
      .createQueryBuilder('t')
      .where('t.status = :st', { st: 'on' })
      .orderBy('t.sort', 'ASC')
      .addOrderBy('t.id', 'DESC')
      .take(20)
      .getMany();
    if (rows.length === 0) return [];
    const ids = rows.map((r) => String(r.id));
    const counts = (await this.postRepo
      .createQueryBuilder('p')
      .select('p.topic_id', 'topicId')
      .addSelect('COUNT(*)', 'cnt')
      .where('p.topic_id IN (:...ids)', { ids })
      .andWhere('p.audit_status = :st', { st: 'approved' })
      .andWhere('p.deleted_at IS NULL')
      .groupBy('p.topic_id')
      .getRawMany()) as { topicId: string; cnt: string }[];
    const map = new Map(counts.map((c) => [String(c.topicId), Number(c.cnt) || 0]));
    return rows.map((t) => ({
      id: Number(t.id),
      title: t.title,
      description: t.description,
      coverUrl: t.coverUrl,
      postCount: map.get(String(t.id)) ?? 0,
    }));
  }

  async feed(query: {
    type?: FeedKind;
    sort?: FeedSort;
    page?: number;
    pageSize?: number;
    userId?: number;
    topicId?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const take = Math.min(50, Math.max(1, Number(query.pageSize) || 10));
    const offset = (page - 1) * take;
    const want = offset + take;
    const type = query.type ?? 'all';
    const sort = query.sort === 'latest' ? 'latest' : 'hot';
    const viewer = query.userId;
    const topicId =
      query.topicId && Number(query.topicId) > 0 ? String(query.topicId) : null;

    const sources = await this.collectSources(type, want, sort, topicId);
    const merged = this.merge(sort, sources);
    const sliced = merged.slice(offset, offset + take);

    const sourceCounts = await this.sourceCounts(type, topicId);

    const items = await this.attachAuthorsAndLikes(sliced, viewer);
    return {
      list: items,
      total: sourceCounts.total,
      hotTotal: sourceCounts.hotTotal,
      page,
      pageSize: take,
      tabs: FEED_TABS,
      topicId: topicId ? Number(topicId) : null,
      hasMore: sliced.length === take && offset + take < sourceCounts.hotTotal,
    };
  }

  // ---------- 各源采集（前 want 条按全局指标排序） ----------

  private async collectSources(
    type: FeedKind,
    want: number,
    sort: FeedSort,
    topicId: string | null,
  ) {
    // 话题仅存在于动态（posts）：指定话题时只聚合动态源
    const onlyPosts = !!topicId;
    const wantPosts =
      onlyPosts || type === 'all' || type === 'checkin' || type === 'text' ? want : 0;
    const wantReviews = !onlyPosts && (type === 'all' || type === 'review') ? want : 0;
    const wantLists = !onlyPosts && (type === 'all' || type === 'booklist') ? want : 0;
    return {
      posts: wantPosts ? await this.queryPosts(type, wantPosts, sort, topicId) : [],
      reviews: wantReviews ? await this.queryReviews(wantReviews, sort) : [],
      lists: wantLists ? await this.queryLists(wantLists, sort) : [],
    };
  }

  private async queryPosts(
    type: FeedKind,
    want: number,
    sort: FeedSort,
    topicId: string | null,
  ) {
    const qb = this.postRepo
      .createQueryBuilder('p')
      .where('p.audit_status = :st', { st: 'approved' })
      .andWhere('p.published_at IS NOT NULL');
    if (topicId) qb.andWhere('p.topic_id = :topicId', { topicId });
    else if (type === 'checkin') qb.andWhere('p.type = :t', { t: 'checkin' });
    else if (type === 'text') qb.andWhere('p.type = :t', { t: 'text' });
    qb.limit(want);
    this.applyOrder(qb, sort, '(p.like_count + p.comment_count)');
    const rows = await qb.getMany();
    return rows.map((p) => ({
      kind: p.type as FeedItem['kind'],
      id: Number(p.id),
      userId: p.userId,
      publishedAt: p.publishedAt,
      content: p.content,
      images: p.images ?? [],
      location: p.location,
      readMinutes: p.readMinutes,
      bookId: p.bookId,
      topicId: p.topicId ? Number(p.topicId) : null,
      likeCount: p.likeCount,
      commentCount: p.commentCount,
      hotScore: p.likeCount + p.commentCount,
      ts: p.publishedAt?.getTime() ?? 0,
    }));
  }

  private async queryReviews(want: number, sort: FeedSort) {
    const qb = this.reviewRepo
      .createQueryBuilder('r')
      .where('r.audit_status = :st', { st: 'approved' })
      .andWhere('r.published_at IS NOT NULL')
      .andWhere('r.deleted_at IS NULL')
      .limit(want);
    this.applyOrder(qb, sort, '(r.like_count + r.comment_count)');
    const rows = await qb.getMany();
    return rows.map((r) => ({
      kind: 'review' as const,
      id: Number(r.id),
      userId: r.userId,
      publishedAt: r.publishedAt,
      bookId: r.bookId,
      title: r.title,
      content: r.content ?? '',
      rating: Number(r.rating) || 0,
      likeCount: r.likeCount,
      commentCount: r.commentCount,
      hotScore: r.likeCount + r.commentCount,
      ts: r.publishedAt?.getTime() ?? 0,
    }));
  }

  private async queryLists(want: number, sort: FeedSort) {
    const qb = this.blRepo
      .createQueryBuilder('bl')
      .where('bl.audit_status = :st', { st: 'approved' })
      .andWhere('bl.published_at IS NOT NULL')
      .limit(want);
    this.applyOrder(qb, sort, 'bl.collect_count');
    const rows = await qb.getMany();
    return rows.map((bl) => ({
      kind: 'booklist' as const,
      id: Number(bl.id),
      userId: bl.userId,
      publishedAt: bl.publishedAt,
      title: bl.title,
      content: bl.description,
      coverUrl: bl.coverUrl,
      itemCount: bl.itemCount,
      isOfficial: !!bl.isOfficial,
      collectCount: bl.collectCount,
      hotScore: bl.collectCount,
      likeCount: 0,
      commentCount: 0,
      ts: bl.publishedAt?.getTime() ?? 0,
    }));
  }

  private applyOrder(qb: any, sort: FeedSort, hotExpr: string) {
    if (sort === 'latest') {
      qb.orderBy('published_at', 'DESC').addOrderBy('id', 'DESC');
    } else {
      qb.orderBy(hotExpr, 'DESC').addOrderBy('id', 'DESC');
    }
  }

  // ---------- 合并 / 排序 ----------

  private merge(sort: FeedSort, sources: Record<string, any[]>) {
    const all = [...sources.posts, ...sources.reviews, ...sources.lists];
    if (sort === 'latest') {
      return all.sort((a, b) => b.ts - a.ts);
    }
    return all.sort((a, b) => b.hotScore - a.hotScore);
  }

  // ---------- 统计 ----------

  private async sourceCounts(type: FeedKind, topicId: string | null) {
    const count = async (qb: any): Promise<number> => {
      const row = (await qb.getRawOne()) as { c: string };
      return Number(row?.c || 0);
    };
    // 指定话题：只统计该话题下已通过的动态
    if (topicId) {
      const c = await count(
        this.postRepo
          .createQueryBuilder('p')
          .select('COUNT(*)', 'c')
          .where('p.audit_status = :st', { st: 'approved' })
          .andWhere('p.published_at IS NOT NULL')
          .andWhere('p.topic_id = :topicId', { topicId }),
      );
      return { total: c, hotTotal: c };
    }
    let total = 0;
    let hotTotal = 0;
    // 全量 or 分类型：统一按已通过（全源）估算，分页基于热门总量（与排序一致）
    if (type === 'checkin' || type === 'text') {
      const c = await count(
        this.postRepo
          .createQueryBuilder('p')
          .select('COUNT(*)', 'c')
          .where('p.audit_status = :st', { st: 'approved' })
          .andWhere('p.published_at IS NOT NULL')
          .andWhere('p.type = :t', { t: type }),
      );
      total = c;
      hotTotal = c;
    } else if (type === 'review') {
      const c = await count(
        this.reviewRepo
          .createQueryBuilder('r')
          .select('COUNT(*)', 'c')
          .where('r.audit_status = :st', { st: 'approved' })
          .andWhere('r.deleted_at IS NULL'),
      );
      total = c;
      hotTotal = c;
    } else if (type === 'booklist') {
      const c = await count(
        this.blRepo
          .createQueryBuilder('bl')
          .select('COUNT(*)', 'c')
          .where('bl.audit_status = :st', { st: 'approved' }),
      );
      total = c;
      hotTotal = c;
    } else {
      const posts = await count(
        this.postRepo
          .createQueryBuilder('p')
          .select('COUNT(*)', 'c')
          .where('p.audit_status = :st', { st: 'approved' }),
      );
      const reviews = await count(
        this.reviewRepo
          .createQueryBuilder('r')
          .select('COUNT(*)', 'c')
          .where('r.audit_status = :st', { st: 'approved' })
          .andWhere('r.deleted_at IS NULL'),
      );
      const lists = await count(
        this.blRepo
          .createQueryBuilder('bl')
          .select('COUNT(*)', 'c')
          .where('bl.audit_status = :st', { st: 'approved' }),
      );
      total = posts + reviews + lists;
      hotTotal = total;
    }
    return { total, hotTotal };
  }

  // ---------- 作者 / 点赞态装配 ----------

  private async attachAuthorsAndLikes(
    rows: Array<Record<string, any>>,
    viewer?: number,
  ): Promise<FeedItem[]> {
    const userIds = [...new Set(rows.map((r) => r.userId))];
    const users = await this.userRepo.find({
      where: { id: In(userIds) },
    });
    const userMap = new Map(users.map((u) => [String(u.id), u]));

    const bookIds = [
      ...new Set(
        rows
          .map((r) => (r.kind === 'booklist' ? null : r.bookId))
          .filter(Boolean),
      ),
    ] as string[];
    const books = bookIds.length ? await this.booksService.findMany(bookIds) : [];
    const bookMap = new Map(books.map((b) => [String(b.id), b]));

    // like 组装：仅 post / review 参与点赞（书单用收藏）
    const likeBearing = rows.filter((r) => r.kind !== 'booklist');
    const likedIds = new Set<string>();
    if (viewer != null && likeBearing.length) {
      const likes = await this.likeRepo.find({
        where: {
          userId: String(viewer),
          targetType: In(['post', 'review']),
          interactionType: 'like',
          targetId: In(likeBearing.map((r) => String(r.id))),
        },
      });
      likes.forEach((l) => likedIds.add(`${l.targetType}:${l.targetId}`));
    }

    return rows.map((r) => {
      const u = userMap.get(String(r.userId));
      const base = {
        kind: r.kind,
        id: r.id,
        author: {
          id: u ? Number(u.id) : Number(r.userId),
          nickname: u?.nickname ?? '已注销用户',
          avatarUrl: u?.avatarUrl ?? '',
          isMember: !!u?.isMember,
        },
        publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
        likeCount: r.likeCount,
        commentCount: r.commentCount,
        collectCount: r.collectCount ?? 0,
        topicId: r.topicId ?? null,
        isLiked:
          r.kind === 'booklist'
            ? false
            : likedIds.has(`${r.kind}:${r.id}`),
      };
      if (r.kind === 'booklist') {
        return {
          ...base,
          title: r.title,
          content: r.content,
          itemCount: r.itemCount,
          isOfficial: r.isOfficial,
        };
      }
      const b = r.bookId ? bookMap.get(String(r.bookId)) : undefined;
      const book = b
        ? {
            id: Number(b.id),
            title: (b as unknown as { title?: string }).title ?? '',
            coverUrl: (b as unknown as { coverUrl?: string }).coverUrl ?? '',
          }
        : null;
      return {
        ...base,
        title: r.title,
        content: r.content,
        rating: r.rating,
        readMinutes: r.readMinutes ?? 0,
        images: r.images ?? [],
        location: r.location ?? '',
        book,
      };
    });
  }
}