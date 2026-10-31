import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { Review } from './entities/review.entity';
import { User } from '../user/entities/user.entity';
import { ModerationService, MachineDecision } from './moderation.service';
import { NotificationService } from '../notification/notification.service';
import { AuthStateService } from '../../common/auth-state/auth-state.service';
import { sanitizeText } from '../../common/utils/sanitize';
import { CreateCommentDto } from './dto/create-comment.dto';

/** 机审决策 → 审核状态（decision 用 reject，存储用 rejected） */
function toAuditStatus(decision: MachineDecision): string {
  if (decision === 'approve') return 'approved';
  if (decision === 'reject') return 'rejected';
  return 'pending';
}

export interface CommentView {
  id: number;
  parentId: number;
  replyToUid: number;
  content: string;
  likeCount: number;
  createdAt: string;
  author: { id: number; nickname: string; avatarUrl: string };
}

@Injectable()
export class CommentService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly moderationService: ModerationService,
    private readonly notificationService: NotificationService,
    private readonly authState: AuthStateService,
  ) {}

  /** 发表书评评论（支持两级回复），并同步书评评论计数 */
  async create(userId: number, reviewId: number, dto: CreateCommentDto) {
    await this.authState.assertCanWrite(userId);
    const review = await this.reviewRepo
      .createQueryBuilder('r')
      .where('r.id = :id', { id: String(reviewId) })
      .andWhere('r.audit_status = :st', { st: 'approved' })
      .andWhere('r.deleted_at IS NULL')
      .getOne();
    if (!review) throw new NotFoundException('书评不存在');

    let parentId = dto.parentId ? String(dto.parentId) : '0';
    let replyToUid = '0';
    if (parentId !== '0') {
      const parent = await this.commentRepo.findOne({
        where: { id: parentId, targetType: 'review', targetId: String(reviewId) },
      });
      if (!parent) throw new NotFoundException('父评论不存在');
      replyToUid = parent.userId;
    }

    const content = sanitizeText(dto.content).slice(0, 1000);
    const check = this.moderationService.check(content);
    const auditStatus = toAuditStatus(check.decision);

    const comment = this.commentRepo.create({
      userId: String(userId),
      targetType: 'review',
      targetId: String(reviewId),
      parentId,
      replyToUid,
      content,
      auditStatus,
    });
    const saved = await this.commentRepo.save(comment);

    // 仅通过审核的评论计入计数，避免待审/驳回内容被计入
    if (auditStatus === 'approved') {
      review.commentCount += 1;
      await this.reviewRepo.save(review);

      // 通知书评作者；若为回复且被回复者非作者，则额外通知被回复者
      await this.notificationService.create({
        userId: review.userId,
        type: 'comment',
        title: parentId !== '0' ? '你的书评收到新的回复' : '你的书评收到新的评论',
        content,
        senderId: userId,
        targetType: 'review',
        targetId: String(reviewId),
      });
      if (replyToUid !== '0' && replyToUid !== review.userId) {
        await this.notificationService.create({
          userId: replyToUid,
          type: 'comment',
          title: '有人回复了你的评论',
          content,
          senderId: userId,
          targetType: 'review',
          targetId: String(reviewId),
        });
      }
    }

    await this.moderationService.log({
      targetType: 'comment',
      targetId: String(saved.id),
      action: 'machine',
      reason: check.reason,
      operatorType: 'machine',
      detail: { score: check.score, decision: check.decision, reviewId },
    });

    const view = await this.toView(saved);
    return {
      ...view,
      audit: { status: auditStatus, reason: check.reason },
    };
  }

  /** 书评评论列表（仅一级与二级已通过评论，按时间正序） */
  async list(reviewId: number) {
    const rows = await this.commentRepo
      .createQueryBuilder('c')
      .where('c.target_type = :tt', { tt: 'review' })
      .andWhere('c.target_id = :tid', { tid: String(reviewId) })
      .andWhere('c.audit_status = :st', { st: 'approved' })
      .orderBy('c.created_at', 'ASC')
      .getMany();

    const users = await this.userRepo.find({
      where: { id: In([...new Set(rows.map((r) => Number(r.userId)))]) },
    });
    const userMap = new Map(users.map((u) => [String(u.id), u]));

    return rows.map((c) => {
      const u = userMap.get(String(c.userId));
      const view: CommentView = {
        id: Number(c.id),
        parentId: Number(c.parentId),
        replyToUid: Number(c.replyToUid),
        content: c.content,
        likeCount: c.likeCount,
        createdAt: c.createdAt.toISOString(),
        author: {
          id: u ? Number(u.id) : Number(c.userId),
          nickname: u?.nickname ?? '已注销用户',
          avatarUrl: u?.avatarUrl ?? '',
        },
      };
      if (c.replyToUid && c.replyToUid !== '0') {
        const replyTo = userMap.get(String(c.replyToUid));
        view['replyToNickname'] = replyTo?.nickname ?? '';
      }
      return view;
    });
  }

  // ---- 内部辅助 ----

  private async toView(comment: Comment): Promise<CommentView> {
    const u = await this.userRepo.findOne({ where: { id: Number(comment.userId) } });
    return {
      id: Number(comment.id),
      parentId: Number(comment.parentId),
      replyToUid: Number(comment.replyToUid),
      content: comment.content,
      likeCount: comment.likeCount,
      createdAt: comment.createdAt.toISOString(),
      author: {
        id: u ? Number(u.id) : Number(comment.userId),
        nickname: u?.nickname ?? '已注销用户',
        avatarUrl: u?.avatarUrl ?? '',
      },
    };
  }
}