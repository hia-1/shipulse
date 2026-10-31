import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtPayload {
  sub: number;
  type: 'user' | 'admin';
  /** 令牌用途：access 用于接口鉴权，refresh 仅可用于 /auth/refresh 换取新令牌 */
  tokenType?: 'access' | 'refresh';
  /** 令牌版本：与库中 users/admins.token_version 比对，不一致即视为已失效 */
  tv?: number;
  iat?: number;
  exp?: number;
}

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: JwtPayload = request.user;
    return data ? user?.[data] : user;
  },
);
