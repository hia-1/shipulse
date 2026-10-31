import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { IsHttpUrl } from '../../../common/validators/custom-validators';

export const EVENT_TYPES = ['reading_camp', 'activity'] as const;
export const EVENT_STATUSES = ['draft', 'ongoing', 'finished', 'canceled'] as const;

/** 创建活动 */
export class CreateEventDto {
  @IsString()
  @MaxLength(128)
  title: string;

  @IsOptional()
  @IsIn(EVENT_TYPES as unknown as string[])
  type: string = 'activity';

  @IsOptional()
  @IsString()
  @MaxLength(512)
  @IsHttpUrl()
  coverUrl = '';

  @IsOptional()
  @IsString()
  description = '';

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsOptional()
  @IsString()
  signupStart?: string;

  @IsOptional()
  @IsString()
  signupEnd?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  capacity = 0;

  @IsOptional()
  @IsBoolean()
  memberOnly = false;

  @IsOptional()
  @IsIn(EVENT_STATUSES as unknown as string[])
  status: string = 'draft';
}

/** 更新活动（局部字段） */
export class UpdateEventDto extends PartialType(CreateEventDto) {}

/** 活动状态流转：ongoing 发布/开始 → finished 结束 → canceled 取消 */
export class UpdateEventStatusDto {
  @IsIn(['ongoing', 'finished', 'canceled'])
  status: string;
}

/** 活动列表查询 */
export class EventQueryDto {
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
  keyword = '';

  @IsOptional()
  @IsString()
  status = '';

  @IsOptional()
  @IsString()
  type = '';
}
