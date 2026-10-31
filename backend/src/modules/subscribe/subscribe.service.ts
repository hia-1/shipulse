import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscribeAuthorization } from './entities/subscribe-authorization.entity';
import { UserAuth } from '../user/entities/user-auth.entity';
import { SendSubscribeDto } from './dto/subscribe.dto';

export interface SubscribeTemplate {
  id: string;
  key: string;
  title: string;
  scene: string;
}

/** 开发占位模板：未配置真实模板ID时使用，保证授权/发送链路可联调 */
const DEV_TEMPLATES: SubscribeTemplate[] = [
  {
    id: 'DEV_READING_REMINDER',
    key: 'reading_reminder',
    title: '阅读提醒',
    scene: '每晚提醒继续阅读',
  },
  {
    id: 'DEV_CHECKIN_REMINDER',
    key: 'checkin_reminder',
    title: '打卡提醒',
    scene: '提醒完成今日阅读打卡',
  },
];

/**
 * 微信订阅消息接入（P2-08）。
 *
 * - 模板：真实模板ID优先（WECHAT_TEMPLATE_IDS），缺失时回退开发占位模板
 * - 授权：记录用户授权额度（一次性订阅可累加），耗尽后需重新授权
 * - 发送：消耗一次额度下发；mock 环境模拟下发，无需真实凭证即可联调
 */
@Injectable()
export class SubscribeService {
  private readonly logger = new Logger(SubscribeService.name);
  /** 微信 access_token 进程内缓存，避免高频获取触发频控 */
  private tokenCache: { token: string; expireAt: number } | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(SubscribeAuthorization)
    private readonly authRepo: Repository<SubscribeAuthorization>,
    @InjectRepository(UserAuth)
    private readonly userAuthRepo: Repository<UserAuth>,
  ) {}

  private get mock(): boolean {
    return !!this.config.get<boolean>('wechat.mock');
  }

  /** 可用模板：真实模板ID优先，缺失时回退开发占位模板 */
  templates(): SubscribeTemplate[] {
    const ids = this.config.get<string[]>('wechat.subscribeTemplateIds') ?? [];
    if (!ids.length) return DEV_TEMPLATES;
    return ids.map((id, i) => {
      const base = DEV_TEMPLATES[i % DEV_TEMPLATES.length];
      return { id, key: base.key, title: base.title, scene: base.scene };
    });
  }

  private isKnown(templateId: string): boolean {
    return this.templates().some((t) => t.id === templateId);
  }

  /** 记录一次授权（累加可下发额度） */
  async authorize(userId: number, templateIds: string[]) {
    const known = this.templates().map((t) => t.id);
    const invalid = templateIds.filter((id) => !known.includes(id));
    if (invalid.length) {
      throw new BadRequestException(`未知的订阅模板：${invalid.join(',')}`);
    }

    const uid = String(userId);
    const now = new Date();
    for (const templateId of templateIds) {
      const existing = await this.authRepo.findOne({
        where: { userId: uid, templateId },
      });
      if (existing) {
        existing.count = Number(existing.count) + 1;
        existing.lastAuthorizedAt = now;
        await this.authRepo.save(existing);
      } else {
        await this.authRepo.save(
          this.authRepo.create({
            userId: uid,
            templateId,
            count: 1,
            lastAuthorizedAt: now,
          }),
        );
      }
    }
    return { accepted: templateIds, status: await this.status(userId) };
  }

  /** 授权状态：模板清单 + 我的授权额度 */
  async status(userId: number) {
    const rows = await this.authRepo.find({
      where: { userId: String(userId) },
    });
    const map = new Map(rows.map((r) => [r.templateId, r]));
    return {
      mock: this.mock,
      templates: this.templates().map((t) => {
        const row = map.get(t.id);
        return {
          ...t,
          authorized: !!row && Number(row.count) > 0,
          remaining: row ? Number(row.count) : 0,
          lastAuthorizedAt: row?.lastAuthorizedAt
            ? row.lastAuthorizedAt.toISOString()
            : null,
        };
      }),
    };
  }

  /** 发送订阅消息：消耗一次授权额度（mock 环境模拟下发） */
  async send(userId: number, dto: SendSubscribeDto) {
    const templateId = dto.templateId;
    if (!this.isKnown(templateId)) {
      throw new BadRequestException('未知的订阅模板');
    }
    const uid = String(userId);
    const row = await this.authRepo.findOne({
      where: { userId: uid, templateId },
    });
    if (!row || Number(row.count) <= 0) {
      throw new BadRequestException('尚无可用授权，请先在小程序内授权订阅消息');
    }

    const openid = await this.resolveOpenid(uid);
    if (!openid) {
      throw new BadRequestException('请先绑定微信身份后再接收订阅消息');
    }

    if (this.mock) {
      row.count = Number(row.count) - 1;
      await this.authRepo.save(row);
      this.logger.log(
        `[mock] 订阅消息下发 userId=${uid} template=${templateId} openid=${openid}`,
      );
      return { sent: true, mock: true, remaining: Number(row.count) };
    }

    const accessToken = await this.getAccessToken();
    const res = await fetch(
      `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          touser: openid,
          template_id: templateId,
          page: dto.page || 'pages/pulse/pulse',
          data: dto.data || {},
        }),
      },
    );
    const data = (await res.json()) as Record<string, any>;
    if (data.errcode !== 0) {
      throw new ServiceUnavailableException(
        `订阅消息发送失败：${data.errmsg || data.errcode}`,
      );
    }
    row.count = Number(row.count) - 1;
    await this.authRepo.save(row);
    return { sent: true, mock: false, remaining: Number(row.count) };
  }

  /** 取用户已绑定的微信 openid（订阅消息接收人标识） */
  private async resolveOpenid(userId: string): Promise<string | null> {
    const auth = await this.userAuthRepo.findOne({
      where: { userId: Number(userId), identityType: 'wechat' },
    });
    return auth ? auth.identifier : null;
  }

  /** 微信 access_token（带进程内缓存） */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expireAt > now + 60_000) {
      return this.tokenCache.token;
    }
    const appId = this.config.get<string>('wechat.appId');
    const appSecret = this.config.get<string>('wechat.appSecret');
    if (!appId || !appSecret) {
      throw new ServiceUnavailableException('微信订阅消息未配置凭证');
    }
    const url =
      'https://api.weixin.qq.com/cgi-bin/token' +
      '?grant_type=client_credential' +
      `&appid=${encodeURIComponent(appId)}` +
      `&secret=${encodeURIComponent(appSecret)}`;
    const res = await fetch(url);
    const data = (await res.json()) as Record<string, any>;
    if (!data.access_token) {
      throw new ServiceUnavailableException('微信 access_token 获取失败');
    }
    this.tokenCache = {
      token: String(data.access_token),
      expireAt: now + Number(data.expires_in ?? 7200) * 1000,
    };
    return this.tokenCache.token;
  }
}
