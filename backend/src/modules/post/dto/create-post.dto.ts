import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { IsHttpUrl, IsNotBlank } from '../../../common/validators/custom-validators';

/** 阅读打卡：每日一次防重复，关联当日阅读场次 */
export class CreateCheckinDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bookId: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;

  /** 手动补充时长（分钟），缺省时按今日该书的已完成场次汇总 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readMinutes?: number;

  /** 关联话题（可选） */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  topicId?: number;
}

/** 图文动态发布 */
export class CreateTextPostDto {
  @IsNotEmpty({ message: '内容不能为空' })
  @IsString()
  @IsNotBlank()
  @Length(1, 1000, { message: '内容长度 1-1000 字' })
  content: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  @IsString({ each: true })
  @IsHttpUrl({ each: true })
  images?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(128)
  location?: string;

  /** 关联话题（可选） */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  topicId?: number;
}