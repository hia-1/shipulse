import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export const REPORT_TARGETS = ['review', 'post', 'comment', 'booklist', 'user'] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_REASONS = ['porn', 'abuse', 'ad', 'spam', 'infringe', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** 用户提交举报 */
export class SubmitReportDto {
  @IsIn(REPORT_TARGETS as unknown as string[])
  targetType: ReportTarget;

  @IsString()
  @MaxLength(20)
  targetId: string;

  @IsIn(REPORT_REASONS as unknown as string[])
  reason: ReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description = '';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images: string[] = [];
}

/** 用户提交申诉 */
export class SubmitAppealDto {
  @IsIn(REPORT_TARGETS as unknown as string[])
  targetType: ReportTarget;

  @IsString()
  @MaxLength(20)
  targetId: string;

  @IsString()
  @MaxLength(500)
  reason: string;
}

/** 管理端处理举报 */
export class HandleReportDto {
  /** resolve 受理并处罚 / reject 驳回举报 */
  @IsIn(['resolve', 'reject'])
  action: 'resolve' | 'reject';

  /** 处罚力度：auto 按累犯自动升级 / delete 删除告知 / mute 禁言7天 / ban 封号 */
  @IsOptional()
  @IsIn(['auto', 'delete', 'mute', 'ban'])
  punishLevel?: 'auto' | 'delete' | 'mute' | 'ban';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  result = '';
}

/** 管理端复核申诉 */
export class ReviewAppealDto {
  /** approve 申诉通过（改判撤销处罚）/ reject 申诉驳回 */
  @IsIn(['approve', 'reject'])
  action: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  result = '';
}

/** 举报/申诉列表查询 */
export class ModerationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  size: number = 15;

  @IsOptional()
  @IsString()
  status = '';

  @IsOptional()
  @IsString()
  targetType = '';

  @IsOptional()
  @IsString()
  keyword = '';
}
