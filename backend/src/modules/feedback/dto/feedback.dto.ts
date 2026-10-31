import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsHttpUrl } from '../../../common/validators/custom-validators';

export const FEEDBACK_TYPES = ['suggestion', 'bug', 'other'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

/** 提交反馈 */
export class SubmitFeedbackDto {
  @IsOptional()
  @IsIn(FEEDBACK_TYPES as unknown as string[])
  type: FeedbackType = 'suggestion';

  @IsString()
  @MinLength(5, { message: '反馈内容至少 5 个字' })
  @MaxLength(1000)
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  contact = '';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsHttpUrl({ each: true })
  images: string[] = [];
}

/** 我的反馈列表查询 */
export class FeedbackQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  size: number = 10;
}
