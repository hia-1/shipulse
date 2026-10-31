import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  Notification,
  NotificationType,
} from '../community/entities/notification.entity';
import { User } from '../user/entities/user.entity';

/** 消息中心分类 Tab（follow 为二期预留，一期归入系统） */
export type NotificationCategory = 'like' | 'comment' | 'system';

const CATEGORY_TYPES: Record<NotificationCategory, NotificationType[]> = {
  like: ['like'],
  comment: ['comment'],
  system: ['system', 'order', 'audit', 'follow'],
};

export interface CreateNotificationInput {
  userId: string | number;
  type: NotificationType;
  title: string;
  content?: string;
  senderId?: string | number;
  targetType?: string;
  targetId?: string | number;
}

/**
 * 站内通知（P2-04 消息中心）。
 *
 * - 触发：点赞 / 评论 / 回复 事件落库（关注为二期预留）
 * - 读取：分类 Tab 过滤、分页、未读数统计、单条/全部已读
 * - 自触发抑制：不给自己的内容产生通知
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * 落库一条通知。失败仅记录日志，不阻断主流程（点赞/评论不应因通知失败而失败）。
   * 收件人等于触发者时静默跳过（自己点赞/评论自己）。
   */
  async create(input: CreateNotificationInput): Promise<void> {
    const recipient = String(input.userId);
    const sender = String(input.senderId ?? 0);
    if (!recipient || recipient === '0') return;
    if (sender !== '0' && sender === recipient) return;

    try {
      await this.notificationRepo.insert({
        userId: recipient,
        type: input.type,
        title: input.title.slice(0, 128),
        content: (input.content ?? '').slice(0, 500),
        senderId: sender,
        targetType: input.targetType ?? '',
        targetId: String(input.targetId ?? 0),
        isRead: 0,
      });
    } catch (e) {
      this.logger.warn(`写入通知失败：${(e as Error).message}`);
    }
  }

  /** 消息列表：按分类过滤 + 分页；附带触发者昵称/头像 */
  async list(
    userId: number,
    query: { type?: string; page?: number; pageSize?: number },
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20));
    const uid = String(userId);

    const qb = this.notificationRepo
      .createQueryBuilder('n')
      .where('n.user_id = :uid', { uid });

    const category = this.normalizeCategory(query.type);
    if (category) {
      qb.andWhere('n.type IN (:...types)', { types: CATEGORY_TYPES[category] });
    }

    qb.orderBy('n.created_at', 'DESC')
      .addOrderBy('n.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [rows, total] = await qb.getManyAndCount();

    const senderIds = [
      ...new Set(
        rows.map((r) => r.senderId).filter((id) => id && id !== '0'),
      ),
    ];
    const senders = senderIds.length
      ? await this.userRepo.find({
          where: { id: In(senderIds.map((id) => Number(id))) },
        })
      : [];
    const senderMap = new Map(senders.map((u) => [String(u.id), u]));

    return {
      list: rows.map((n) => {
        const s = senderMap.get(String(n.senderId));
        return {
          id: Number(n.id),
          type: n.type,
          category: this.categoryOf(n.type),
          title: n.title,
          content: n.content,
          senderId: String(n.senderId),
          sender: s
            ? { id: Number(s.id), nickname: s.nickname, avatarUrl: s.avatarUrl }
            : null,
          targetType: n.targetType,
          targetId: String(n.targetId),
          isRead: n.isRead === 1,
          readAt: n.readAt ? n.readAt.toISOString() : null,
          createdAt: n.createdAt.toISOString(),
        };
      }),
      total,
      page,
      pageSize,
    };
  }

  /** 未读数：总数 + 各分类（供角标与 Tab 徽标） */
  async unreadCount(userId: number) {
    const uid = String(userId);
    const rows = (await this.notificationRepo
      .createQueryBuilder('n')
      .select('n.type', 'type')
      .addSelect('COUNT(*)', 'cnt')
      .where('n.user_id = :uid', { uid })
      .andWhere('n.is_read = 0')
      .groupBy('n.type')
      .getRawMany()) as { type: NotificationType; cnt: string }[];

    const byType: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      const c = Number(r.cnt) || 0;
      byType[r.type] = c;
      total += c;
    }
    const sum = (types: NotificationType[]) =>
      types.reduce((acc, t) => acc + (byType[t] ?? 0), 0);

    return {
      total,
      like: sum(CATEGORY_TYPES.like),
      comment: sum(CATEGORY_TYPES.comment),
      system: sum(CATEGORY_TYPES.system),
    };
  }

  /** 单条标记已读（仅限本人；重复标记幂等） */
  async markRead(userId: number, id: number) {
    const note = await this.notificationRepo.findOne({
      where: { id: String(id), userId: String(userId) },
    });
    if (!note) throw new NotFoundException('通知不存在');
    if (note.isRead !== 1) {
      await this.notificationRepo.update(
        { id: String(id), userId: String(userId) },
        { isRead: 1, readAt: new Date() },
      );
    }
    return { id: Number(id), isRead: true };
  }

  /** 全部标记已读（可按分类）；返回本次影响条数 */
  async markAllRead(userId: number, type?: string) {
    const uid = String(userId);
    const qb = this.notificationRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: 1, readAt: new Date() })
      .where('user_id = :uid', { uid })
      .andWhere('is_read = 0');

    const category = this.normalizeCategory(type);
    if (category) {
      qb.andWhere('type IN (:...types)', { types: CATEGORY_TYPES[category] });
    }

    const res = await qb.execute();
    return { updated: Number(res.affected ?? 0) };
  }

  // ---- 内部辅助 ----

  private normalizeCategory(type?: string): NotificationCategory | null {
    if (!type || type === 'all') return null;
    if (type === 'like' || type === 'comment' || type === 'system') return type;
    // 兼容直接传具体类型：order/audit/follow 归入 system
    if (type === 'order' || type === 'audit' || type === 'follow') return 'system';
    return null;
  }

  private categoryOf(type: NotificationType): NotificationCategory {
    if (type === 'like') return 'like';
    if (type === 'comment') return 'comment';
    return 'system';
  }
}