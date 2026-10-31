import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Report, ReportReason, ReportStatus } from './entities/report.entity';
import { Appeal, AppealStatus } from './entities/appeal.entity';
import { Notification } from './entities/notification.entity';
import { ModerationLog } from './entities/moderation-log.entity';
import { Review } from './entities/review.entity';
import { Comment } from './entities/comment.entity';
import { Post } from '../post/entities/post.entity';
import { Booklist } from '../booklist/entities/booklist.entity';
import { ModerationService, ModerationTarget } from './moderation.service';
import { AuthStateService } from '../../common/auth-state/auth-state.service';
import { sanitizeText } from '../../common/utils/sanitize';
import {
  HandleReportDto,
  ModerationQueryDto,
  ReviewAppealDto,
  SubmitAppealDto,
  SubmitReportDto,
} from './dto/report.dto';

export type PunishLevel = 'delete' | 'mute' | 'ban';

interface TargetInfo {
  authorId: string;
  title: string;
}

/**
 * 内容安全闭环（P2-12）：举报处理 + 阶梯处罚 + 用户申诉。
 *
 * - 举报：接收 → 核实 → 分级阶梯处罚（删除+告知 → 禁言7天 → 封号）
 * - 阶梯升级：以该用户名下历史处罚次数（moderation_logs 中 warn/mute/ban）自动升级
 * - 申诉：处罚告知 → 申诉提交 → 人工复核改判
 * - 留痕：全部动作写入 moderation_logs
 */
@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Report) private readonly reportRepo: Repository<Report>,
    @InjectRepository(Appeal) private readonly appealRepo: Repository<Appeal>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(ModerationLog)
    private readonly logRepo: Repository<ModerationLog>,
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Comment) private readonly commentRepo: Repository<Comment>,
    @InjectRepository(Post) private readonly postRepo: Repository<Post>,
    @InjectRepository(Booklist)
    private readonly booklistRepo: Repository<Booklist>,
    private readonly moderation: ModerationService,
    private readonly authState: AuthStateService,
  ) {}

  // ==================== 用户端 ====================

  /** 提交举报（同一用户对同一对象的待处理举报去重） */
  async submitReport(userId: number, dto: SubmitReportDto) {
    const targetId = String(dto.targetId).trim();
    if (!/^\d+$/.test(targetId)) {
      throw new BadRequestException('举报对象不存在');
    }
    const info = await this.resolveTarget(dto.targetType, targetId);
    if (!info) throw new NotFoundException('举报对象不存在或已删除');
    if (info.authorId === String(userId)) {
      throw new BadRequestException('不能举报自己发布的内容');
    }

    const dup = await this.reportRepo.findOne({
      where: {
        reporterId: String(userId),
        targetType: dto.targetType,
        targetId,
        status: In(['pending', 'processing'] as ReportStatus[]),
      },
    });
    if (dup) throw new ConflictException('你已举报过该内容，请等待处理结果');

    const report = this.reportRepo.create({
      reporterId: String(userId),
      reporterType: 'user',
      targetType: dto.targetType,
      targetId,
      reason: dto.reason as ReportReason,
      description: sanitizeText(dto.description ?? '').slice(0, 500),
      images: dto.images?.length ? dto.images.slice(0, 9) : null,
      status: 'pending',
    });
    const saved = await this.reportRepo.save(report);
    return { id: Number(saved.id), status: saved.status };
  }

  /** 提交申诉（须存在针对该用户/该对象的处罚记录） */
  async submitAppeal(userId: number, dto: SubmitAppealDto) {
    const targetId = String(dto.targetId).trim();
    const uid = String(userId);

    // 关联最近一次与该对象相关的处罚记录（删除/禁言/封号）
    const log = await this.logRepo.findOne({
      where: [
        { targetType: dto.targetType as ModerationTarget, targetId, action: In(['delete', 'warn', 'mute', 'ban']) },
        { targetType: 'user' as ModerationTarget, targetId: uid, action: In(['warn', 'mute', 'ban']) },
      ],
      order: { id: 'DESC' },
    });
    if (!log) {
      throw new BadRequestException('未找到对应的处罚记录，无法申诉');
    }

    const pending = await this.appealRepo.findOne({
      where: { userId: uid, targetType: dto.targetType, targetId, status: 'pending' },
    });
    if (pending) throw new ConflictException('该处罚已有待复核的申诉，请耐心等待');

    const appeal = this.appealRepo.create({
      userId: uid,
      targetType: dto.targetType,
      targetId,
      moderationLogId: log ? String(log.id) : null,
      reason: sanitizeText(dto.reason).slice(0, 500),
      status: 'pending',
    });
    const saved = await this.appealRepo.save(appeal);
    return { id: Number(saved.id), status: saved.status };
  }

  /** 我的申诉列表 */
  async myAppeals(userId: number, page = 1, size = 10) {
    const take = Math.min(Math.max(1, size), 50);
    const [rows, total] = await this.appealRepo.findAndCount({
      where: { userId: String(userId) },
      order: { createdAt: 'DESC' },
      skip: Math.max(0, page - 1) * take,
      take,
    });
    return {
      items: rows.map((a) => this.appealView(a)),
      total,
      page,
      size: take,
    };
  }

  // ==================== 管理端 ====================

  async listReports(query: ModerationQueryDto) {
    const { page, size, skip } = this.pageParams(query.page, query.size);
    const qb = this.reportRepo.createQueryBuilder('r');
    if (query.status) qb.andWhere('r.status = :status', { status: query.status });
    if (query.targetType) qb.andWhere('r.target_type = :tt', { tt: query.targetType });
    const [rows, total] = await qb
      .orderBy('r.created_at', 'DESC')
      .skip(skip)
      .take(size)
      .getManyAndCount();
    return {
      items: rows.map((r) => this.reportView(r)),
      total,
      page,
      size,
    };
  }

  /** 处理举报：受理（分级处罚）或驳回 */
  async handleReport(adminId: number, id: string, dto: HandleReportDto) {
    const report = await this.reportRepo.findOne({ where: { id: String(id) } });
    if (!report) throw new NotFoundException('举报不存在');
    if (report.status === 'resolved' || report.status === 'rejected') {
      throw new ConflictException('该举报已处理');
    }

    if (dto.action === 'reject') {
      report.status = 'rejected';
      report.handlerId = String(adminId);
      report.handleResult = sanitizeText(dto.result || '举报不成立').slice(0, 255);
      report.handledAt = new Date();
      await this.reportRepo.save(report);
      return { id: Number(report.id), status: report.status };
    }

    const info = await this.resolveTarget(report.targetType, report.targetId);
    if (!info) throw new NotFoundException('被举报内容已不存在');
    const level = await this.resolvePunishLevel(info.authorId, dto.punishLevel);
    const punishText = await this.applyPunishment(
      adminId,
      report.targetType,
      report.targetId,
      info,
      level,
    );

    report.status = 'resolved';
    report.handlerId = String(adminId);
    report.handleResult = sanitizeText(dto.result || punishText).slice(0, 255);
    report.handledAt = new Date();
    await this.reportRepo.save(report);

    return {
      id: Number(report.id),
      status: report.status,
      punishLevel: level,
      punishText,
    };
  }

  async listAppeals(query: ModerationQueryDto) {
    const { page, size, skip } = this.pageParams(query.page, query.size);
    const qb = this.appealRepo.createQueryBuilder('a');
    if (query.status) qb.andWhere('a.status = :status', { status: query.status });
    if (query.targetType) qb.andWhere('a.target_type = :tt', { tt: query.targetType });
    const [rows, total] = await qb
      .orderBy('a.created_at', 'DESC')
      .skip(skip)
      .take(size)
      .getManyAndCount();
    return {
      items: rows.map((a) => this.appealView(a)),
      total,
      page,
      size,
    };
  }

  /** 复核申诉：通过则改判撤销处罚，驳回则维持 */
  async reviewAppeal(adminId: number, id: string, dto: ReviewAppealDto) {
    const appeal = await this.appealRepo.findOne({ where: { id: String(id) } });
    if (!appeal) throw new NotFoundException('申诉不存在');
    if (appeal.status !== 'pending') throw new ConflictException('该申诉已复核');

    appeal.reviewerId = String(adminId);
    appeal.reviewResult = sanitizeText(dto.result || '').slice(0, 255);
    appeal.reviewedAt = new Date();

    if (dto.action === 'approve') {
      appeal.status = 'approved';
      // 改判：恢复账号状态；若处罚为删除内容，则尝试恢复被删内容
      await this.authState.revokePunishment(Number(appeal.userId));
      await this.restoreTarget(appeal.targetType, appeal.targetId);
      await this.moderation.log({
        targetType: appeal.targetType,
        targetId: appeal.targetId,
        action: 'appeal_pass',
        reason: appeal.reviewResult || '申诉通过，撤销处罚',
        operatorType: 'admin',
        operatorId: adminId,
        detail: { appealId: String(appeal.id), userId: appeal.userId },
      });
      await this.notify(
        appeal.userId,
        '申诉已通过',
        '你的申诉已通过复核，相关处罚已撤销。',
        appeal.targetType,
        appeal.targetId,
      );
    } else {
      appeal.status = 'rejected';
      await this.moderation.log({
        targetType: appeal.targetType,
        targetId: appeal.targetId,
        action: 'appeal_reject',
        reason: appeal.reviewResult || '申诉驳回，维持原处罚',
        operatorType: 'admin',
        operatorId: adminId,
        detail: { appealId: String(appeal.id), userId: appeal.userId },
      });
      await this.notify(
        appeal.userId,
        '申诉未通过',
        `你的申诉经复核后维持原处罚。${appeal.reviewResult}`,
        appeal.targetType,
        appeal.targetId,
      );
    }

    await this.appealRepo.save(appeal);
    return { id: Number(appeal.id), status: appeal.status };
  }

  // ==================== 内部辅助 ====================

  /** 按累犯次数自动定级：首次删除告知 → 二次禁言7天 → 三次及以上封号 */
  private async resolvePunishLevel(
    authorId: string,
    override?: 'auto' | PunishLevel,
  ): Promise<PunishLevel> {
    if (override && override !== 'auto') return override;
    const prior = await this.logRepo.count({
      where: {
        targetType: 'user' as ModerationTarget,
        targetId: authorId,
        action: In(['warn', 'mute', 'ban']),
      },
    });
    if (prior <= 0) return 'delete';
    if (prior === 1) return 'mute';
    return 'ban';
  }

  private async applyPunishment(
    adminId: number,
    targetType: ModerationTarget,
    targetId: string,
    info: TargetInfo,
    level: PunishLevel,
  ): Promise<string> {
    const authorId = info.authorId;
    if (level === 'delete') {
      await this.softDeleteTarget(targetType, targetId);
      await this.moderation.log({
        targetType,
        targetId,
        action: 'delete',
        reason: '举报核实违规，删除内容',
        operatorType: 'admin',
        operatorId: adminId,
      });
      await this.moderation.log({
        targetType: 'user',
        targetId: authorId,
        action: 'warn',
        reason: `发布违规内容（${info.title}），首次警告并删除`,
        operatorType: 'admin',
        operatorId: adminId,
      });
      await this.notify(
        authorId,
        '内容违规提醒',
        `你发布的《${info.title}》因违规已被删除，请遵守社区规范。`,
        targetType,
        targetId,
      );
      return '首次违规：删除内容并告知';
    }

    if (level === 'mute') {
      await this.softDeleteTarget(targetType, targetId);
      await this.authState.applyPunishment(Number(authorId), 'mute', 7);
      await this.moderation.log({
        targetType: 'user',
        targetId: authorId,
        action: 'mute',
        reason: '再次违规，禁言7天',
        operatorType: 'admin',
        operatorId: adminId,
      });
      await this.notify(
        authorId,
        '账号已被禁言',
        '你因再次发布违规内容被禁言7天，期间无法发布内容，到期自动恢复。',
        targetType,
        targetId,
      );
      return '再次违规：禁言7天';
    }

    // ban
    await this.softDeleteTarget(targetType, targetId);
    await this.authState.applyPunishment(Number(authorId), 'ban');
    await this.moderation.log({
      targetType: 'user',
      targetId: authorId,
      action: 'ban',
      reason: '多次违规，封号处理',
      operatorType: 'admin',
      operatorId: adminId,
    });
    await this.notify(
      authorId,
      '账号已被封禁',
      '你因多次发布违规内容被封禁，如有异议可提交申诉。',
      targetType,
      targetId,
    );
    return '多次违规：封号处理';
  }

  private async softDeleteTarget(targetType: ModerationTarget, targetId: string) {
    if (targetType === 'review') await this.reviewRepo.softDelete({ id: targetId });
    else if (targetType === 'post') await this.postRepo.softDelete({ id: targetId });
    else if (targetType === 'comment') await this.commentRepo.softDelete({ id: targetId });
    else if (targetType === 'booklist') await this.booklistRepo.softDelete({ id: targetId });
  }

  private async restoreTarget(targetType: ModerationTarget, targetId: string) {
    if (targetType === 'review') await this.reviewRepo.restore({ id: targetId });
    else if (targetType === 'post') await this.postRepo.restore({ id: targetId });
    else if (targetType === 'comment') await this.commentRepo.restore({ id: targetId });
    else if (targetType === 'booklist') await this.booklistRepo.restore({ id: targetId });
  }

  /** 解析被举报对象的作者与标题（用于处罚与告知） */
  private async resolveTarget(
    targetType: ModerationTarget,
    targetId: string,
  ): Promise<TargetInfo | null> {
    if (targetType === 'review') {
      const r = await this.reviewRepo.findOne({ where: { id: targetId }, withDeleted: true });
      return r ? { authorId: String(r.userId), title: r.title || '书评' } : null;
    }
    if (targetType === 'post') {
      const p = await this.postRepo.findOne({ where: { id: targetId }, withDeleted: true });
      return p ? { authorId: String(p.userId), title: p.content.slice(0, 20) || '动态' } : null;
    }
    if (targetType === 'comment') {
      const c = await this.commentRepo.findOne({ where: { id: targetId }, withDeleted: true });
      return c ? { authorId: String(c.userId), title: c.content.slice(0, 20) || '评论' } : null;
    }
    if (targetType === 'booklist') {
      const b = await this.booklistRepo.findOne({ where: { id: targetId }, withDeleted: true });
      return b ? { authorId: String(b.userId), title: b.title || '书单' } : null;
    }
    if (targetType === 'user') {
      return { authorId: targetId, title: '用户主页' };
    }
    return null;
  }

  private async notify(
    userId: string,
    title: string,
    content: string,
    targetType: string,
    targetId: string,
  ) {
    await this.notificationRepo.insert({
      userId,
      type: 'audit',
      title,
      content,
      senderId: '0',
      targetType,
      targetId,
      isRead: 0,
    });
  }

  private reportView(r: Report) {
    return {
      id: Number(r.id),
      reporterId: String(r.reporterId),
      reporterType: r.reporterType,
      targetType: r.targetType,
      targetId: String(r.targetId),
      reason: r.reason,
      description: r.description,
      images: r.images ?? [],
      status: r.status,
      handlerId: r.handlerId ? String(r.handlerId) : null,
      handleResult: r.handleResult,
      handledAt: r.handledAt,
      createdAt: r.createdAt,
    };
  }

  private appealView(a: Appeal) {
    return {
      id: Number(a.id),
      userId: String(a.userId),
      targetType: a.targetType,
      targetId: String(a.targetId),
      moderationLogId: a.moderationLogId ? String(a.moderationLogId) : null,
      reason: a.reason,
      status: a.status as AppealStatus,
      reviewerId: a.reviewerId ? String(a.reviewerId) : null,
      reviewResult: a.reviewResult,
      reviewedAt: a.reviewedAt,
      createdAt: a.createdAt,
    };
  }

  private pageParams(page = 1, size = 15) {
    const p = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const s =
      Number.isFinite(size) && size > 0 ? Math.min(Math.floor(size), 200) : 15;
    return { page: p, size: s, skip: (p - 1) * s };
  }
}
