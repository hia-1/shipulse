import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { Like } from './entities/like.entity';
import { User } from '../user/entities/user.entity';
import { ModerationService } from './moderation.service';
import { NotificationService } from '../notification/notification.service';
import { BooksService } from '../library/books.service';
import { AuthStateService } from '../../common/auth-state/auth-state.service';
import { sanitizeText } from '../../common/utils/sanitize';
import { CreateReviewDto } from './dto/create-review.dto';

export interface ReviewView {
  id: number;
  bookId: number;
  bookTitle: string;
  coverUrl: string;
  rating: number;
  title: string;
  content: string;
  likeCount: number;
  commentCount: number;
  auditStatus: string;
  auditReason: string;
  isFeatured: boolean;
  publishedAt: string | null;
  createdAt: string;
  author: { id: number; nickname: string; avatarUrl: string; isMember: boolean };
}

/** 半星步进校验 / 格式化 */
export function normalizeRating(rating: number): number {
  const clamped = Math.max(0.5, Math.min(5, Number(rating) || 0));
  return Math.round(clamped * 2) / 2;
}

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Like)
    private readonly likeRepo: Repository<Like>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly moderationService: ModerationService,
    private readonly notificationService: NotificationService,
    private readonly booksService: BooksService,
    private readonly authState: AuthStateService,
  ) {}

  /**
   * 发布书评：机审通过即发布 / 可疑挂起 / 驳回。
   * 审核通过的书评参与书籍平均分与评分人数冗余更新。
   */
  async create(userId: number, dto: CreateReviewDto) {
    await this.authState.assertCanWrite(userId);
    const book = await this.booksService.findBookOnShelf(String(dto.bookId));
    if (!book) throw new NotFoundException('书籍不存在或未上架');

    const uid = String(userId);
    // 同一本书只允许一条有效书评；若旧书评为软删除，则清理后允许重写
    const existing = await this.reviewRepo
      .createQueryBuilder('r')
      .where('r.user_id = :uid AND r.book_id = :bookId', {
        uid,
        bookId: String(dto.bookId),
      })
      .withDeleted()
      .getOne();
    if (existing) {
      if (!existing.deletedAt) {
        throw new ConflictException('你已评价过这本书，可在个人中心查看');
      }
      // 删除后重写：硬删除残留的软删除行，避免其干扰「我的书评」等查询
      await this.reviewRepo.delete({ id: existing.id });
    }

    const rating = normalizeRating(dto.rating);

    const review = this.reviewRepo.create({
      userId: uid,
      bookId: String(dto.bookId),
      rating: rating.toFixed(1),
      title: sanitizeText(dto.title),
      content: dto.content?.trim() ? sanitizeText(dto.content) : null,
      shortCode: this.generateShortCode(),
      auditStatus: 'pending',
    });

    // 机审
    const check = this.moderationService.check(review.title + ' ' + (review.content ?? ''));
    review.machineScore = check.score;
    review.auditReason = check.reason || '';

    let decision = check.decision;
    if (decision === 'approve') {
      review.auditStatus = 'approved';
      review.publishedAt = new Date();
    } else if (decision === 'reject') {
      review.auditStatus = 'rejected';
    } else {
      review.auditStatus = 'pending';
    }

    const saved = await this.reviewRepo.save(review);

    // 审核留痕
    await this.moderationService.log({
      targetType: 'review',
      targetId: saved.id,
      action: 'machine',
      reason: check.reason,
      operatorType: 'machine',
      detail: { score: check.score, bookId: dto.bookId, decision },
    });

    // 通过即更新书籍评分/书评数
    if (decision === 'approve') {
      await this.recomputeBookStats(String(dto.bookId));
    }

    const view = await this.toView(saved);
    return {
      ...view,
      audit: { status: review.auditStatus, reason: review.auditReason },
    };
  }

  /** 书评列表（仅已通过审核；可按书/按用户/关键词筛选，排序：默认精选+最新 / 热门点赞） */
  async list(query: {
    bookId?: string;
    userId?: string;
    keyword?: string;
    sort?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 10));
    const qb = this.reviewRepo
      .createQueryBuilder('r')
      .where('r.audit_status = :st', { st: 'approved' })
      .andWhere('r.deleted_at IS NULL');

    if (query.bookId) qb.andWhere('r.book_id = :bookId', { bookId: query.bookId });
    if (query.userId) qb.andWhere('r.user_id = :userId', { userId: query.userId });
    if (query.keyword) {
      // 命中书评标题/正文，或书评所属书籍书名
      qb.andWhere(
        '(r.title LIKE :kw OR r.content LIKE :kw OR r.book_id IN (SELECT b.id FROM books b WHERE b.title LIKE :kw))',
        { kw: `%${query.keyword}%` },
      );
    }

    if (query.sort === 'hot') {
      qb.orderBy('r.like_count', 'DESC').addOrderBy('r.published_at', 'DESC');
    } else if (query.sort === 'rating') {
      qb.orderBy('r.rating', 'DESC').addOrderBy('r.published_at', 'DESC');
    } else {
      qb.orderBy('r.is_featured', 'DESC').addOrderBy('r.published_at', 'DESC');
    }

    const [rows, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { list: await this.toViews(rows), total, page, pageSize };
  }

  /** 书评详情（仅已通过；登录用户可携带点赞状态） */
  async detail(id: number, viewerId?: number) {
    const review = await this.reviewRepo
      .createQueryBuilder('r')
      .where('r.id = :id', { id: String(id) })
      .andWhere('r.audit_status = :st', { st: 'approved' })
      .andWhere('r.deleted_at IS NULL')
      .getOne();
    if (!review) throw new NotFoundException('书评不存在或未通过审核');

    const view = await this.toView(review);
    if (viewerId) {
      view['isLiked'] = await this.hasLiked(String(viewerId), String(id));
    } else {
      view['isLiked'] = false;
    }
    return view;
  }

  /** 我某本书的书评（任意审核状态，未发评返回 null） */
  async mine(userId: number, bookId: string) {
    const review = await this.reviewRepo
      .createQueryBuilder('r')
      .where('r.user_id = :uid AND r.book_id = :bookId', {
        uid: String(userId),
        bookId,
      })
      .withDeleted()
      .getOne();
    if (!review) return null;
    const view = await this.toView(review);
    return {
      ...view,
      audit: { status: review.auditStatus, reason: review.auditReason },
    };
  }

  /** 我的书评列表（任意审核状态，供个人中心展示） */
  async myList(userId: number, page = 1, pageSize = 10) {
    const take = Math.min(Math.max(1, pageSize), 50);
    const qb = this.reviewRepo
      .createQueryBuilder('r')
      .where('r.user_id = :uid', { uid: String(userId) })
      .orderBy('r.created_at', 'DESC')
      .skip(Math.max(0, page - 1) * take)
      .take(take);
    const [rows, total] = await qb.getManyAndCount();

    const views = await this.toViews(rows);
    return {
      list: views.map((v) => {
        const row = rows.find((r) => Number(r.id) === v.id);
        return {
          ...v,
          audit: {
            status: row?.auditStatus ?? v.auditStatus,
            reason: row?.auditReason ?? v.auditReason,
          },
        };
      }),
      total,
      page,
      pageSize: take,
    };
  }

  /** 删除自己的书评（软删除，同步重算书籍评分） */
  async remove(userId: number, id: number) {
    const review = await this.reviewRepo.findOne({
      where: { id: String(id), userId: String(userId) },
    });
    if (!review) throw new NotFoundException('书评不存在');
    await this.reviewRepo.softDelete({ id: String(id) });
    await this.moderationService.log({
      targetType: 'review',
      targetId: String(id),
      action: 'delete',
      operatorType: 'system',
      operatorId: userId,
      reason: '作者删除',
    });
    await this.recomputeBookStats(review.bookId);
    return { deleted: true, id: Number(id) };
  }

  /** 点赞/取消点赞书评，返回最新点赞数与状态（仅已通过审核的书评可点赞） */
  async toggleLike(userId: number, id: number) {
    const review = await this.reviewRepo
      .createQueryBuilder('r')
      .where('r.id = :id', { id: String(id) })
      .andWhere('r.audit_status = :st', { st: 'approved' })
      .andWhere('r.deleted_at IS NULL')
      .getOne();
    if (!review) throw new NotFoundException('书评不存在或未通过审核');

    const existing = await this.likeRepo.findOne({
      where: {
        userId: String(userId),
        targetType: 'review',
        targetId: String(id),
        interactionType: 'like',
      },
    });

    let isLiked: boolean;
    if (existing) {
      // 按条件删除并仅在确实删除时原子减一，避免并发下计数漂移
      const del = await this.likeRepo.delete({ id: existing.id });
      if (del.affected) {
        await this.reviewRepo.decrement({ id: String(id) }, 'likeCount', 1);
      }
      isLiked = false;
    } else {
      // orIgnore：并发重复插入被唯一键去重，仅首次成功者计数
      const ins = await this.likeRepo
        .createQueryBuilder()
        .insert()
        .into(Like)
        .values({
          userId: String(userId),
          targetType: 'review',
          targetId: String(id),
          interactionType: 'like',
        })
        .orIgnore()
        .execute();
      // 以 affectedRows 判断是否真正插入：orIgnore 命中重复时 identifiers 仍非空，不可据此计数
      if (Number((ins.raw as { affectedRows?: number })?.affectedRows ?? 0) > 0) {
        await this.reviewRepo.increment({ id: String(id) }, 'likeCount', 1);
        // 通知书评作者（自赞由 NotificationService 抑制）
        await this.notificationService.create({
          userId: review.userId,
          type: 'like',
          title: '你的书评收到新的点赞',
          content: review.title,
          senderId: userId,
          targetType: 'review',
          targetId: String(id),
        });
      }
      isLiked = true;
    }

    const fresh = await this.reviewRepo.findOne({
      where: { id: String(id) },
      select: ['likeCount'],
    });
    return { isLiked, likeCount: fresh?.likeCount ?? review.likeCount, id: Number(id) };
  }

  /** 重算书籍评分冗余字段（评分人数 / 均分 / 书评数），仅计已通过书评 */
  async recomputeBookStats(bookId: string) {
    const row = (await this.reviewRepo
      .createQueryBuilder('r')
      .select('COUNT(*)', 'cnt')
      .addSelect('AVG(r.rating)', 'avg')
      .where('r.book_id = :bookId', { bookId })
      .andWhere('r.audit_status = :st', { st: 'approved' })
      .andWhere('r.deleted_at IS NULL')
      .getRawOne()) as { cnt: string; avg: string | null };
    const cnt = Number(row?.cnt || 0);
    const avg = row?.avg != null ? Number(row.avg) : 0;
    await this.booksService.refreshStats(bookId, {
      ratingCount: cnt,
      ratingAvg: cnt > 0 ? Math.round(avg * 100) / 100 : 0,
      reviewCount: cnt,
    });
  }

  // ---- 内部辅助 ----

  private async hasLiked(userId: string, targetId: string): Promise<boolean> {
    const like = await this.likeRepo.findOne({
      where: {
        userId,
        targetType: 'review',
        targetId,
        interactionType: 'like',
      },
    });
    return !!like;
  }

  private async toViews(reviews: Review[]): Promise<ReviewView[]> {
    if (reviews.length === 0) return [];
    const users = await this.userRepo.find({
      where: { id: In([...new Set(reviews.map((r) => Number(r.userId)))]) },
    });
    const userMap = new Map(users.map((u) => [String(u.id), u]));
    const bookIds = [...new Set(reviews.map((r) => r.bookId))];
    const books = await this.booksService.findMany(bookIds);
    const bookMap = new Map(books.map((b) => [String(b.id), b]));
    return reviews.map((r) => {
      const u = userMap.get(String(r.userId));
      const b = bookMap.get(String(r.bookId));
      return {
        id: Number(r.id),
        bookId: Number(r.bookId),
        bookTitle: (b?.title as string) ?? '书籍已下架',
        coverUrl: (b?.coverUrl as string) ?? '',
        rating: Number(r.rating) || 0,
        title: r.title,
        content: r.content ?? '',
        likeCount: r.likeCount,
        commentCount: r.commentCount,
        auditStatus: r.auditStatus,
        auditReason: r.auditReason,
        isFeatured: !!r.isFeatured,
        publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
        author: {
          id: u ? Number(u.id) : Number(r.userId),
          nickname: u?.nickname ?? '已注销用户',
          avatarUrl: u?.avatarUrl ?? '',
          isMember: !!u?.isMember,
        },
      };
    });
  }

  private async toView(review: Review): Promise<ReviewView> {
    const [view] = await this.toViews([review]);
    return view;
  }

  /** 生成对外分享短码（防枚举） */
  private generateShortCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }
}