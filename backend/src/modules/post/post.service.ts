import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { Like } from '../community/entities/like.entity';
import { User } from '../user/entities/user.entity';
import { Topic } from '../home/entities/topic.entity';
import { ReadingSession } from '../reading/entities/reading-session.entity';
import { BooksService } from '../library/books.service';
import { ModerationService, MachineDecision } from '../community/moderation.service';
import { NotificationService } from '../notification/notification.service';
import { AuthStateService } from '../../common/auth-state/auth-state.service';
import { sanitizeText } from '../../common/utils/sanitize';
import { CreateCheckinDto, CreateTextPostDto } from './dto/create-post.dto';

/** 机审决策 → 持久化审核状态（decision 用 reject，存储用 rejected） */
function toAuditStatus(decision: MachineDecision): Post['auditStatus'] {
  if (decision === 'approve') return 'approved';
  if (decision === 'reject') return 'rejected';
  return 'pending';
}

export interface PostCard {
  id: number;
  type: string;
  content: string;
  images: string[];
  location: string;
  readMinutes: number;
  topicId: number | null;
  likeCount: number;
  commentCount: number;
  auditStatus: string;
  auditReason: string;
  publishedAt: string | null;
  createdAt: string;
  book: { id: number; title: string; coverUrl: string } | null;
  author: { id: number; nickname: string; avatarUrl: string; isMember: boolean };
  isLiked: boolean;
}

@Injectable()
export class PostService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    @InjectRepository(Like)
    private readonly likeRepo: Repository<Like>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ReadingSession)
    private readonly sessionRepo: Repository<ReadingSession>,
    @InjectRepository(Topic)
    private readonly topicRepo: Repository<Topic>,
    private readonly booksService: BooksService,
    private readonly moderationService: ModerationService,
    private readonly notificationService: NotificationService,
    private readonly dataSource: DataSource,
    private readonly authState: AuthStateService,
  ) {}

  /** 阅读打卡：每日一次，关联当日已完成阅读场次 */
  async createCheckin(userId: number, dto: CreateCheckinDto) {
    await this.authState.assertCanWrite(userId);
    const uid = String(userId);
    const bookIdStr = String(dto.bookId);

    const book = await this.booksService.findBookOnShelf(bookIdStr);
    if (!book) throw new NotFoundException('书籍不存在或未上架');

    // 关联当日该书的已完成场次计算阅读时长
    const readMinutes = await this.todayBookMinutes(uid, bookIdStr, dto.readMinutes);
    if (readMinutes <= 0) {
      throw new BadRequestException('请先完成今日阅读再打卡（无今日阅读时长）');
    }

    const checkinContent = sanitizeText(dto.content ?? '');
    const check = this.moderationService.check(checkinContent);
    const auditStatus = toAuditStatus(check.decision);
    const topicId = await this.resolveTopicId(dto.topicId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 事务 + 用户行锁：同一用户的并发打卡被串行化，杜绝「先查后写」竞态导致当日重复打卡
    const saved = await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [uid]);
      const dup = await manager
        .createQueryBuilder(Post, 'p')
        .where('p.user_id = :uid', { uid })
        .andWhere('p.type = :type', { type: 'checkin' })
        .andWhere('p.created_at >= :today', { today })
        .andWhere('p.created_at < :tomorrow', { tomorrow })
        .getOne();
      if (dup) throw new ConflictException('今天已经打卡过了，明天再来吧');

      return manager.save(
        manager.create(Post, {
          userId: uid,
          type: 'checkin',
          bookId: bookIdStr,
          topicId,
          content: checkinContent,
          readMinutes,
          shortCode: this.generateShortCode(),
          auditStatus,
          auditReason: check.reason || '',
          machineScore: check.score,
          publishedAt: auditStatus === 'approved' ? new Date() : null,
        }),
      );
    });

    await this.moderationService.log({
      targetType: 'post',
      targetId: saved.id,
      action: 'machine',
      reason: check.reason,
      operatorType: 'machine',
      detail: { score: check.score, type: 'checkin', decision: check.decision },
    });

    const view = await this.toCard(saved, false);
    return {
      ...view,
      audit: { status: saved.auditStatus, reason: saved.auditReason },
    };
  }

  /** 图文动态发布（走机审） */
  async createText(userId: number, dto: CreateTextPostDto) {
    await this.authState.assertCanWrite(userId);
    const content = sanitizeText(dto.content);
    const check = this.moderationService.check(content);
    const auditStatus = toAuditStatus(check.decision);
    const topicId = await this.resolveTopicId(dto.topicId);

    const saved = await this.postRepo.save(
      this.postRepo.create({
        userId: String(userId),
        type: 'text',
        topicId,
        content,
        images: dto.images?.length ? dto.images : null,
        location: sanitizeText(dto.location ?? ''),
        shortCode: this.generateShortCode(),
        auditStatus,
        auditReason: check.reason || '',
        machineScore: check.score,
        publishedAt: auditStatus === 'approved' ? new Date() : null,
      }),
    );

    await this.moderationService.log({
      targetType: 'post',
      targetId: saved.id,
      action: 'machine',
      reason: check.reason,
      operatorType: 'machine',
      detail: { score: check.score, type: 'text', decision: check.decision },
    });

    const view = await this.toCard(saved, false);
    return {
      ...view,
      audit: { status: saved.auditStatus, reason: saved.auditReason },
    };
  }

  /** 今日打卡状态与今日阅读时长（打卡按钮态） */
  async todayStatus(userId: number) {
    const checked = await this.todayCheckin(userId);
    const totalSeconds = await this.todayTotalSeconds(String(userId));
    return {
      checkedToday: !!checked,
      todayMinutes: Math.floor(totalSeconds / 60),
      checked: checked
        ? { id: Number(checked.id), readMinutes: checked.readMinutes }
        : null,
    };
  }

  /** 我的动态（任意审核状态，供个人中心） */
  async myPosts(userId: number, page = 1, pageSize = 10) {
    const take = Math.min(Math.max(1, pageSize), 50);
    const qb = this.postRepo
      .createQueryBuilder('p')
      .where('p.user_id = :uid', { uid: String(userId) })
      .orderBy('p.created_at', 'DESC')
      .skip(Math.max(0, page - 1) * take)
      .take(take);
    const [rows, total] = await qb.getManyAndCount();
    const views = await this.toCards(rows, userId);
    return {
      list: views.map((v) => {
        const row = rows.find((r) => Number(r.id) === v.id);
        return {
          ...v,
          audit: { status: row?.auditStatus ?? v.auditStatus, reason: row?.auditReason ?? '' },
        };
      }),
      total,
      page,
      pageSize: take,
    };
  }

  /** 动态详情（仅已通过；登录可带点赞态） */
  async detail(id: number, viewerId?: number) {
    const post = await this.postRepo
      .createQueryBuilder('p')
      .where('p.id = :id', { id: String(id) })
      .andWhere('p.audit_status = :st', { st: 'approved' })
      .andWhere('p.deleted_at IS NULL')
      .getOne();
    if (!post) throw new NotFoundException('动态不存在或未通过审核');
    const isLiked = viewerId
      ? await this.hasLiked(String(viewerId), String(id))
      : false;
    return this.toCard(post, isLiked);
  }

  /** 点赞/取消点赞动态（仅已通过审核的动态可点赞，避免对未发布内容刷赞） */
  async toggleLike(userId: number, id: number) {
    const post = await this.postRepo
      .createQueryBuilder('p')
      .where('p.id = :id', { id: String(id) })
      .andWhere('p.audit_status = :st', { st: 'approved' })
      .andWhere('p.deleted_at IS NULL')
      .getOne();
    if (!post) throw new NotFoundException('动态不存在或未通过审核');

    const existing = await this.likeRepo.findOne({
      where: {
        userId: String(userId),
        targetType: 'post',
        targetId: String(id),
        interactionType: 'like',
      },
    });

    let isLiked: boolean;
    if (existing) {
      // 按条件删除并仅在确实删除时原子减一，避免并发下计数漂移
      const del = await this.likeRepo.delete({ id: existing.id });
      if (del.affected) {
        await this.postRepo.decrement({ id: String(id) }, 'likeCount', 1);
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
          targetType: 'post',
          targetId: String(id),
          interactionType: 'like',
        })
        .orIgnore()
        .execute();
      // 以 affectedRows 判断是否真正插入：orIgnore 命中重复时 identifiers 仍非空，不可据此计数
      if (Number((ins.raw as { affectedRows?: number })?.affectedRows ?? 0) > 0) {
        await this.postRepo.increment({ id: String(id) }, 'likeCount', 1);
        // 通知动态作者（自赞由 NotificationService 抑制）
        await this.notificationService.create({
          userId: post.userId,
          type: 'like',
          title: '你的动态收到新的点赞',
          content: post.content.slice(0, 60),
          senderId: userId,
          targetType: 'post',
          targetId: String(id),
        });
      }
      isLiked = true;
    }

    const fresh = await this.postRepo.findOne({
      where: { id: String(id) },
      select: ['likeCount'],
    });
    return { isLiked, likeCount: fresh?.likeCount ?? post.likeCount, id: Number(id) };
  }

  /** 删除自己的动态（软删除） */
  async remove(userId: number, id: number) {
    const post = await this.postRepo.findOne({
      where: { id: String(id), userId: String(userId) },
    });
    if (!post) throw new NotFoundException('动态不存在');
    await this.postRepo.softDelete({ id: String(id) });
    await this.moderationService.log({
      targetType: 'post',
      targetId: String(id),
      action: 'delete',
      operatorType: 'system',
      operatorId: userId,
      reason: '作者删除',
    });
    return { deleted: true, id: Number(id) };
  }

  // ---------- 内部辅助 ----------

  private async todayCheckin(userId: number): Promise<Post | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return this.postRepo
      .createQueryBuilder('p')
      .where('p.user_id = :uid', { uid: String(userId) })
      .andWhere('p.type = :type', { type: 'checkin' })
      .andWhere('p.created_at >= :today', { today })
      .andWhere('p.created_at < :tomorrow', { tomorrow })
      .orderBy('p.created_at', 'DESC')
      .getOne();
  }

  private async todayBookMinutes(
    uid: string,
    bookId: string,
    fallback?: number,
  ): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const raw = (await this.sessionRepo
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.duration_seconds), 0)', 'secs')
      .where('s.user_id = :uid', { uid })
      .andWhere('s.book_id = :bookId', { bookId })
      .andWhere('s.start_time >= :today', { today })
      .andWhere('s.start_time < :tomorrow', { tomorrow })
      .getRawOne()) as { secs: string };
    const secs = Number(raw?.secs || 0);
    if (secs > 0) return Math.max(1, Math.round(secs / 60));
    return Number(fallback) || 0;
  }

  private async todayTotalSeconds(uid: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const raw = (await this.sessionRepo
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.duration_seconds), 0)', 'secs')
      .where('s.user_id = :uid', { uid })
      .andWhere('s.start_time >= :today', { today })
      .andWhere('s.start_time < :tomorrow', { tomorrow })
      .getRawOne()) as { secs: string };
    return Number(raw?.secs || 0);
  }

  private async hasLiked(userId: string, targetId: string): Promise<boolean> {
    return !!(await this.likeRepo.findOne({
      where: { userId, targetType: 'post', targetId, interactionType: 'like' },
    }));
  }

  async toCards(posts: Post[], viewerId?: number): Promise<PostCard[]> {
    if (posts.length === 0) return [];
    const users = await this.userRepo.find({
      where: { id: In([...new Set(posts.map((r) => Number(r.userId)))]) },
    });
    const userMap = new Map(users.map((u) => [String(u.id), u]));
    const bookIds = [...new Set(posts.map((r) => r.bookId).filter(Boolean))] as string[];
    const books = bookIds.length ? await this.booksService.findMany(bookIds) : [];
    const bookMap = new Map(books.map((b) => [String(b.id), b]));

    const likedIds = new Set<string>();
    if (viewerId != null) {
      const likes = await this.likeRepo.find({
        where: {
          userId: String(viewerId),
          targetType: 'post',
          interactionType: 'like',
          targetId: In(posts.map((r) => String(r.id))),
        },
      });
      likes.forEach((l) => likedIds.add(l.targetId));
    }

    return posts.map((p) => {
      const u = userMap.get(String(p.userId));
      const b = p.bookId ? bookMap.get(String(p.bookId)) : undefined;
      return {
        id: Number(p.id),
        type: p.type,
        content: p.content,
        images: p.images ?? [],
        location: p.location,
        readMinutes: p.readMinutes,
        topicId: p.topicId ? Number(p.topicId) : null,
        likeCount: p.likeCount,
        commentCount: p.commentCount,
        auditStatus: p.auditStatus,
        auditReason: p.auditReason,
        publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
        createdAt: p.createdAt.toISOString(),
        book: b
          ? {
              id: Number(b.id),
              title: (b as unknown as { title?: string }).title ?? '',
              coverUrl: (b as unknown as { coverUrl?: string }).coverUrl ?? '',
            }
          : null,
        author: {
          id: u ? Number(u.id) : Number(p.userId),
          nickname: u?.nickname ?? '已注销用户',
          avatarUrl: u?.avatarUrl ?? '',
          isMember: !!u?.isMember,
        },
        isLiked: likedIds.has(String(p.id)),
      };
    });
  }

  private async toCard(post: Post, isLiked: boolean): Promise<PostCard> {
    const [view] = await this.toCards([post], isLiked ? 0 : undefined);
    view.isLiked = view.isLiked || isLiked;
    return view;
  }

  private generateShortCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  /** 校验并规范化话题：必须存在且已上线，否则报错（避免关联到下线/不存在的话题） */
  private async resolveTopicId(topicId?: number): Promise<string | null> {
    if (!topicId) return null;
    const topic = await this.topicRepo.findOne({
      where: { id: String(topicId), status: 'on' },
    });
    if (!topic) throw new BadRequestException('话题不存在或已下线');
    return String(topic.id);
  }
}