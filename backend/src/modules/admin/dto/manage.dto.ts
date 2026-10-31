import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  IsHttpUrl,
  IsNotBlank,
  IsSafeLink,
} from '../../../common/validators/custom-validators';

/** 通用分页查询参数 */
export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  size: number = 15;

  @IsOptional()
  @IsString()
  keyword = '';

  @IsOptional()
  @IsString()
  status = '';
}

export function pageParams(page = 1, size = 15) {
  const p = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const s =
    Number.isFinite(size) && size > 0
      ? Math.min(Math.floor(size), 200)
      : 15;
  return { page: p, size: s, skip: (p - 1) * s };
}

export function toList<T>(items: T[], total: number, page: number, size: number) {
  return { items, total, page, size };
}

/** 用户状态更新（域与 users.status 一致：active 正常 / muted 禁言 / banned 封禁 / canceled 注销） */
export class UpdateUserStatusDto {
  @IsIn(['active', 'muted', 'banned', 'canceled'])
  status: string;
}

/** 手动开通/取消会员（0 取消 / 1 开通） */
export class ToggleMemberDto {
  @Type(() => Number)
  @IsInt()
  @IsIn([0, 1])
  isMember: number;
}

/** 书籍状态更新（需与读者端书城 status 域一致：on_shelf/off_shelf/pending） */
export class UpdateBookStatusDto {
  @IsIn(['on_shelf', 'off_shelf', 'pending'])
  status: string;
}

/** 审核动作 */
export class AuditActionDto {
  @IsIn(['approve', 'reject'])
  action: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason = '';
}

/** Banner 创建/更新 */
export class BannerDto {
  @IsString()
  @MaxLength(128)
  title: string;

  @IsString()
  @MaxLength(512)
  @IsHttpUrl()
  imageUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  position = 'home_top';

  @IsOptional()
  @IsString()
  @MaxLength(16)
  linkType = 'none';

  @IsOptional()
  @IsString()
  @MaxLength(512)
  @IsSafeLink()
  linkValue = '';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort = 0;

  @IsOptional()
  @IsIn(['on', 'off'])
  status = 'on';

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;
}

/** 专栏/每周好书 创建更新 */
export class ColumnDto {
  @IsIn(['weekly_pick', 'editorial'])
  type: string;

  @IsString()
  @MaxLength(128)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  subtitle = '';

  @IsOptional()
  @Type(() => String)
  bookId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  @IsHttpUrl()
  coverUrl = '';

  @IsOptional()
  @IsString()
  content = '';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort = 0;

  @IsOptional()
  @IsIn(['on', 'off', 'pending'])
  status = 'on';

  @IsOptional()
  @IsString()
  publishedAt?: string;
}

/** Banner 更新（支持仅上下架/局部字段） */
export class UpdateBannerDto extends PartialType(BannerDto) {}

/** 专栏/每周好书 更新（支持仅上下架/局部字段） */
export class UpdateColumnDto extends PartialType(ColumnDto) {}

/** 话题 创建/更新 */
export class TopicDto {
  @IsString()
  @IsNotEmpty({ message: '话题名称不能为空' })
  @IsNotBlank({ message: '话题名称不能为纯空白' })
  @MaxLength(128)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description = '';

  @IsOptional()
  @IsString()
  @MaxLength(512)
  @IsHttpUrl()
  coverUrl = '';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort = 0;

  @IsOptional()
  @IsIn(['on', 'off'])
  status = 'on';
}

/** 话题 更新（支持仅上下架/局部字段） */
export class UpdateTopicDto extends PartialType(TopicDto) {}

/** 兑换码批量生成 */
export class RedeemGenerateDto {
  @IsString()
  planId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationDays: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  count = 10;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  batchNo = '';
}

/** 修改管理员密码 */
export class ChangePasswordDto {
  @IsString()
  @MaxLength(64)
  oldPassword: string;

  @IsString()
  @MinLength(6, { message: '新密码至少 6 位' })
  @MaxLength(64)
  newPassword: string;
}

/** 修改管理员资料 */
export class UpdateAdminProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  @IsHttpUrl()
  avatarUrl?: string;
}

/** 兑换码批量更新状态占位（保留，便于扩展） */
export class RedeemListDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  batchNo?: string;
}

/** 新建管理员账号 */
export class CreateAdminDto {
  @IsString()
  @MaxLength(64)
  username: string;

  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(64)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  name = '';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleCodes: string[] = [];
}

/** 更新管理员（资料 / 状态 / 角色） */
export class UpdateAdminDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;

  @IsOptional()
  @IsIn(['active', 'disabled'])
  status?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(64)
  password?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleCodes?: string[];
}

/** 角色创建/更新 */
export class RoleDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsString()
  @MaxLength(64)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description = '';

  @IsArray()
  @IsString({ each: true })
  permissions: string[] = [];

  @IsOptional()
  @IsIn(['active', 'disabled'])
  status = 'active';
}

/** 操作日志查询 */
export class OperationLogQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  module = '';

  @IsOptional()
  @IsString()
  adminId = '';
}