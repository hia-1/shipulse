import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { User } from '../user/entities/user.entity';
import { UserAuth } from '../user/entities/user-auth.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { WechatLoginDto } from './dto/wechat-login.dto';
import { AuthStateService } from '../../common/auth-state/auth-state.service';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends TokenPair {
  user: Record<string, any>;
}

interface WechatSession {
  openid: string;
  unionid: string | null;
}

@Injectable()
export class AuthService {
  /** 微信 access_token 进程内缓存（用于手机号解密接口，有效期约 2h） */
  private accessTokenCache: { token: string; expireAt: number } | null = null;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserAuth)
    private readonly userAuthRepo: Repository<UserAuth>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authState: AuthStateService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    this.verifyCode(dto.phone, dto.code);

    const existing = await this.userAuthRepo.findOne({
      where: { identityType: 'phone', identifier: dto.phone },
    });
    if (existing) {
      throw new ConflictException('该手机号已注册');
    }

    const user = this.userRepo.create({
      phone: dto.phone,
      nickname: dto.nickname || `书友${dto.phone.slice(-4)}`,
    });
    await this.userRepo.save(user);

    const auth = this.userAuthRepo.create({
      userId: user.id,
      identityType: 'phone',
      identifier: dto.phone,
      verified: 1,
      lastUsedAt: new Date(),
    });
    await this.userAuthRepo.save(auth);

    const tokens = await this.generateTokens(
      { sub: Number(user.id), type: 'user' },
      Number(user.tokenVersion ?? 0),
    );
    return { ...tokens, user: this.sanitizeUser(user) };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    this.verifyCode(dto.phone, dto.code);

    const auth = await this.userAuthRepo.findOne({
      where: { identityType: 'phone', identifier: dto.phone },
    });
    // 不区分「未注册 / 账号异常」，统一凭证错误，避免手机号枚举
    if (!auth) {
      throw new UnauthorizedException('手机号或验证码错误');
    }

    auth.lastUsedAt = new Date();
    await this.userAuthRepo.save(auth);

    return this.issueForUser(Number(auth.userId));
  }

  /**
   * 微信小程序一键登录：code 换 openid，可选 phoneCode 绑定手机号。
   * 以手机号为统一标识：命中已存在的手机号账号则合并（同一用户），否则新建。
   */
  async wechatLogin(dto: WechatLoginDto): Promise<AuthResult> {
    const session = await this.code2session(dto.code);

    // 1) 已绑定过微信身份 → 直接登录（并补齐 unionid）
    const existing = await this.userAuthRepo.findOne({
      where: { identityType: 'wechat', identifier: session.openid },
    });
    if (existing) {
      if (session.unionid && !existing.unionid) {
        existing.unionid = session.unionid;
      }
      existing.lastUsedAt = new Date();
      await this.userAuthRepo.save(existing);
      return this.issueForUser(Number(existing.userId));
    }

    // 2) 首次微信登录：按手机号与 Web 账号合并
    const phone = dto.phoneCode ? await this.resolvePhone(dto.phoneCode) : null;
    let user: User | null = null;
    if (phone) {
      const phoneAuth = await this.userAuthRepo.findOne({
        where: { identityType: 'phone', identifier: phone },
      });
      if (phoneAuth) {
        user = await this.userRepo.findOne({ where: { id: phoneAuth.userId } });
      }
    }

    if (!user) {
      user = this.userRepo.create({
        phone: phone ?? null,
        nickname:
          dto.nickname || (phone ? `书友${phone.slice(-4)}` : '微信书友'),
        avatarUrl: dto.avatarUrl || '',
      });
      await this.userRepo.save(user);
      if (phone) {
        await this.userAuthRepo.save(
          this.userAuthRepo.create({
            userId: user.id,
            identityType: 'phone',
            identifier: phone,
            verified: 1,
            lastUsedAt: new Date(),
          }),
        );
      }
    } else if (!user.avatarUrl && dto.avatarUrl) {
      // 合并到已有账号：仅在原头像为空时补全，避免覆盖用户在 Web 端设置
      user.avatarUrl = dto.avatarUrl;
      await this.userRepo.save(user);
    }

    // 绑定微信身份（并发下可能已写入，忽略重复）
    try {
      await this.userAuthRepo.save(
        this.userAuthRepo.create({
          userId: user.id,
          identityType: 'wechat',
          identifier: session.openid,
          unionid: session.unionid,
          verified: 1,
          lastUsedAt: new Date(),
        }),
      );
    } catch {
      // 唯一约束冲突说明已被并发请求绑定，无需处理
    }

    return this.issueForUser(Number(user.id));
  }

  async refresh(dto: RefreshDto): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.configService.get<string>('jwt.secret'),
      });
    } catch {
      throw new UnauthorizedException('refreshToken 无效或已过期');
    }
    // 仅接受 refresh 令牌，防止把 access 令牌当作长期刷新凭证反复续期
    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('无效的令牌类型');
    }
    if (payload.type !== 'user' && payload.type !== 'admin') {
      throw new UnauthorizedException('无效的令牌类型');
    }
    // 以库为准：账号被封禁/注销/停用，或令牌版本已变更（改密/登出），一律拒绝续期
    const stillValid =
      payload.type === 'admin'
        ? await this.authState.isAdminTokenValid(payload.sub, payload.tv)
        : await this.authState.isUserTokenValid(payload.sub, payload.tv);
    if (!stillValid) {
      throw new UnauthorizedException('refreshToken 已失效，请重新登录');
    }
    return this.generateTokens(
      { sub: payload.sub, type: payload.type },
      Number(payload.tv ?? 0),
    );
  }

  /** 退出登录：令牌版本 +1，使该账号所有已签发令牌立即失效 */
  async logout(userId: number): Promise<{ ok: true }> {
    await this.authState.bumpUserTokenVersion(userId);
    return { ok: true };
  }

  /** 以库为准校验账号可用性并签发令牌（登录/微信登录共用） */
  private async issueForUser(userId: number): Promise<AuthResult> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    // 禁言（muted）仅限制发布，仍可登录浏览；封禁/注销才拒绝登录
    if (!user || (user.status !== 'active' && user.status !== 'muted')) {
      throw new UnauthorizedException('账号已被禁用');
    }
    user.lastLoginAt = new Date();
    await this.userRepo.save(user);

    const tokens = await this.generateTokens(
      { sub: Number(user.id), type: 'user' },
      Number(user.tokenVersion ?? 0),
    );
    return { ...tokens, user: this.sanitizeUser(user) };
  }

  /** 微信登录凭证换取 openid / unionid（mock 适配层隔离开发与生产差异） */
  private async code2session(code: string): Promise<WechatSession> {
    const mock = this.configService.get<boolean>('wechat.mock');
    if (mock) {
      // 开发/测试：code 形如 mock-openid:XXX 时取 XXX；否则按 code 派生稳定 openid
      const openid = code.startsWith('mock-openid:')
        ? code.slice('mock-openid:'.length)
        : `dev_${createHash('sha256').update(code).digest('hex').slice(0, 16)}`;
      return { openid, unionid: null };
    }

    const appId = this.configService.get<string>('wechat.appId');
    const appSecret = this.configService.get<string>('wechat.appSecret');
    if (!appId || !appSecret) {
      throw new ServiceUnavailableException('微信登录未配置');
    }
    const url =
      'https://api.weixin.qq.com/sns/jscode2session' +
      `?appid=${encodeURIComponent(appId)}` +
      `&secret=${encodeURIComponent(appSecret)}` +
      `&js_code=${encodeURIComponent(code)}` +
      '&grant_type=authorization_code';
    const data = await this.wechatGet(url);
    if (!data.openid) {
      throw new UnauthorizedException(
        `微信登录失败：${data.errmsg || 'invalid code'}`,
      );
    }
    return { openid: String(data.openid), unionid: data.unionid ?? null };
  }

  /** 手机号凭证换真实手机号（mock 下 phoneCode 直接视为手机号） */
  private async resolvePhone(phoneCode: string): Promise<string | null> {
    const mock = this.configService.get<boolean>('wechat.mock');
    if (mock) {
      return /^1[3-9]\d{9}$/.test(phoneCode) ? phoneCode : null;
    }

    const appId = this.configService.get<string>('wechat.appId');
    const appSecret = this.configService.get<string>('wechat.appSecret');
    if (!appId || !appSecret) {
      throw new ServiceUnavailableException('微信登录未配置');
    }
    const token = await this.getAccessToken(appId, appSecret);
    const url = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(token)}`;
    const data = await this.wechatGet(url, { code: phoneCode });
    if (data.errcode !== 0) {
      return null;
    }
    const info = data.phone_info || {};
    return info.purePhoneNumber || info.phoneNumber || null;
  }

  /** 微信 access_token（带进程内缓存，避免高频获取触发频控） */
  private async getAccessToken(
    appId: string,
    appSecret: string,
  ): Promise<string> {
    const now = Date.now();
    if (this.accessTokenCache && this.accessTokenCache.expireAt > now + 60_000) {
      return this.accessTokenCache.token;
    }
    const url =
      'https://api.weixin.qq.com/cgi-bin/token' +
      '?grant_type=client_credential' +
      `&appid=${encodeURIComponent(appId)}` +
      `&secret=${encodeURIComponent(appSecret)}`;
    const data = await this.wechatGet(url);
    if (!data.access_token) {
      throw new ServiceUnavailableException('微信 access_token 获取失败');
    }
    this.accessTokenCache = {
      token: String(data.access_token),
      expireAt: now + Number(data.expires_in ?? 7200) * 1000,
    };
    return this.accessTokenCache.token;
  }

  /** 统一调用微信 HTTP 接口（GET 或带 JSON body 的 POST） */
  private async wechatGet(
    url: string,
    body?: Record<string, unknown>,
  ): Promise<Record<string, any>> {
    const res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return (await res.json()) as Record<string, any>;
  }

  private async generateTokens(
    payload: { sub: number; type: 'user' | 'admin' },
    tokenVersion = 0,
  ): Promise<TokenPair> {
    const secret = this.configService.get<string>('jwt.secret');
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload, tv: tokenVersion, tokenType: 'access' },
        {
          secret,
          expiresIn: this.configService.get<string>('jwt.accessExpires'),
        },
      ),
      this.jwtService.signAsync(
        { ...payload, tv: tokenVersion, tokenType: 'refresh' },
        {
          secret,
          expiresIn: this.configService.get<string>('jwt.refreshExpires'),
        },
      ),
    ]);
    return { accessToken, refreshToken };
  }

  private verifyCode(phone: string, code: string): void {
    if (this.configService.get<boolean>('isDev')) {
      if (code !== '123456') {
        throw new UnauthorizedException('验证码错误（dev 环境固定 123456）');
      }
      return;
    }
    // TODO: prod 环境接入腾讯云短信服务
    throw new UnauthorizedException('短信验证码服务暂未配置');
  }

  private sanitizeUser(user: User): Record<string, any> {
    return {
      id: Number(user.id),
      phone: user.phone,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      gender: user.gender,
      bio: user.bio,
      status: user.status,
      isMember: user.isMember,
      memberExpireAt: user.memberExpireAt,
      createdAt: user.createdAt,
    };
  }
}
