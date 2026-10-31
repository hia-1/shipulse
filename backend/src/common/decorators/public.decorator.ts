import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const IS_OPTIONAL_AUTH_KEY = 'optionalAuth';
/**
 * 可选登录：公开可访问，但若携带有效 access 令牌则解析出用户。
 * 用于需要返回「当前用户态」（如是否已收藏/是否本人）的公开接口。
 */
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);

export const IS_ADMIN_AREA_KEY = 'isAdminArea';
/**
 * 标记「管理端区域」控制器：只有该类接口才允许 admin 令牌访问。
 * 全局 JwtAuthGuard 据此拒绝 admin 令牌调用用户侧接口，
 * 避免 admin 令牌的 sub 被用户侧当作 userId 使用（身份串号）。
 */
export const AdminArea = () => SetMetadata(IS_ADMIN_AREA_KEY, true);