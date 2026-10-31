import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthStateService } from '../auth-state/auth-state.service';
import type { JwtPayload } from '../decorators/current-user.decorator';

/**
 * 管理端守卫：要求携带有效 JWT 且 type === 'admin'
 * 和全局 JwtAuthGuard 叠加使用（本守卫不开放 @Public 跳过的语义，
 * 仅用于放在管理侧 controller 上进一步收紧身份类型）。
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authState: AuthStateService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('缺少管理员令牌');
    }
    const token = authHeader.substring(7);
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });
    } catch {
      throw new UnauthorizedException('需要管理员权限');
    }
    if (payload.tokenType !== 'access' || payload.type !== 'admin') {
      throw new UnauthorizedException('需要管理员权限');
    }
    // 以库为准：管理员被停用或改密后，旧令牌立即失效
    if (!(await this.authState.isAdminTokenValid(payload.sub, payload.tv))) {
      throw new UnauthorizedException('令牌已失效，请重新登录');
    }
    request.user = payload;
    return true;
  }
}