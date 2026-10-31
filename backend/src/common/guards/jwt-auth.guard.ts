import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IS_PUBLIC_KEY, IS_OPTIONAL_AUTH_KEY, IS_ADMIN_AREA_KEY } from '../decorators/public.decorator';
import { AuthStateService } from '../auth-state/auth-state.service';
import type { JwtPayload } from '../decorators/current-user.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
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

    const isOptional = this.reflector.getAllAndOverride<boolean>(IS_OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      if (isOptional) return true;
      throw new UnauthorizedException('缺少认证令牌');
    }

    const token = authHeader.substring(7);
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });
    } catch {
      if (isOptional) return true;
      throw new UnauthorizedException('令牌无效或已过期');
    }

    // 仅接受 access 令牌，避免长效 refresh 令牌被当作访问凭证直接调用业务接口
    if (payload.tokenType !== 'access') {
      if (isOptional) return true;
      throw new UnauthorizedException('令牌类型不正确');
    }

    // 身份边界：admin 令牌仅限管理端区域接口使用。
    // 否则其 sub 会被用户侧接口当作 userId，造成「管理员令牌读写同 ID 用户数据」的身份串号。
    const isAdminArea = this.reflector.getAllAndOverride<boolean>(IS_ADMIN_AREA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (payload.type === 'admin' && !isAdminArea) {
      if (isOptional) return true;
      throw new UnauthorizedException('令牌类型不适用于该接口');
    }

    // 以库为准：账号被封禁/注销，或令牌版本已被 +1（改密/登出），旧令牌立即失效
    if (!(await this.isTokenStillValid(payload))) {
      if (isOptional) return true;
      throw new UnauthorizedException('令牌已失效，请重新登录');
    }

    request.user = payload;
    return true;
  }

  private async isTokenStillValid(payload: JwtPayload): Promise<boolean> {
    if (payload.type === 'admin') {
      return this.authState.isAdminTokenValid(payload.sub, payload.tv);
    }
    if (payload.type === 'user') {
      return this.authState.isUserTokenValid(payload.sub, payload.tv);
    }
    return false;
  }
}