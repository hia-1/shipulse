import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModerationLog } from './entities/moderation-log.entity';

export type MachineDecision = 'approve' | 'pending' | 'reject';
export type ModerationTarget =
  | 'review'
  | 'post'
  | 'comment'
  | 'booklist'
  | 'user';

export interface MachineCheckResult {
  /** 机审结论：通过 / 可疑转人工 / 驳回 */
  decision: MachineDecision;
  /** 机审风险分 0-100（越高越危险） */
  score: number;
  /** 命中说明 / 驳回原因 */
  reason: string;
}

/**
 * 内容安全审核状态机（P1-08）
 *
 * 机审适配层：开发期使用本地关键词 Mock；生产可替换为第三方内容安全 API
 * （腾讯天御 ContentSecurity），只需实现 `check()` 返回 MachineCheckResult。
 *
 * 审核流转：pending（机审中/可疑待人工）→ approved（通过发布）| rejected（驳回）。
 * 每次机审与人工处置均写入 moderation_logs 留痕。
 */
@Injectable()
export class ModerationService {
  constructor(
    @InjectRepository(ModerationLog)
    private readonly logRepo: Repository<ModerationLog>,
  ) {}

  /** 确定驳回的违规关键词（命中即驳回） */
  private static readonly rejectKeywords = [
    '含血喷人',
    '下流',
    '淫秽',
    '代开发票',
    '加微信',
    '发票',
    '赌博',
    '毒品',
    '色情',
    '赌博网站',
    '刷单',
    '广告招租',
  ];

  /** 可疑关键词（命中转人工复核） */
  private static readonly suspectKeywords = [
    '妈的',
    '该死',
    '垃圾网站',
    '有病',
    '滚',
    '傻',
    '举报你',
  ];

  /**
   * 机审检查文本，返回结论。Mock 版基于关键词加权打分；
   * 接入天御等真实 API 时实现此方法即可。
   */
  static analyze(text: string | null): MachineCheckResult {
    const src = (text ?? '').toLowerCase();
    let score = 0;
    let reason = '';

    for (const kw of ModerationService.rejectKeywords) {
      if (src.includes(kw)) {
        score = 100;
        reason = `命中违规词「${kw}」`;
        return { decision: 'reject', score, reason };
      }
    }
    for (const kw of ModerationService.suspectKeywords) {
      if (src.includes(kw)) {
        score = Math.max(score, 65);
        reason = `命中敏感词「${kw}」，转人工复核`;
      }
    }

    if (score > 0) return { decision: 'pending', score, reason };
    return { decision: 'approve', score: 0, reason: '' };
  }

  /** 内部：实例方法委托给静态分析（便于测试与替换） */
  check(text: string | null): MachineCheckResult {
    return ModerationService.analyze(text);
  }

  /** 写入审核日志（机审或人工处置均留痕） */
  async log(params: {
    targetType: ModerationTarget;
    targetId: string;
    action:
      | 'machine'
      | 'approve'
      | 'reject'
      | 'delete'
      | 'warn'
      | 'mute'
      | 'ban'
      | 'appeal_pass'
      | 'appeal_reject';
    reason?: string;
    operatorType?: 'machine' | 'system' | 'admin';
    operatorId?: number;
    detail?: Record<string, unknown>;
  }): Promise<void> {
    await this.logRepo.insert({
      targetType: params.targetType,
      targetId: String(params.targetId),
      action: params.action,
      reason: params.reason ?? '',
      operatorType: params.operatorType ?? 'machine',
      operatorId: String(params.operatorId ?? 0),
      detail: params.detail ?? null,
    });
  }
}