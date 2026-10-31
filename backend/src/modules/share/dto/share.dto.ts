import { Type } from 'class-transformer';
import { IsIn, IsInt, Min } from 'class-validator';

export type ShareTypeDto = 'pulse' | 'booklist' | 'review' | 'post' | 'book';

/** 生成/获取分享卡片与短码 */
export class CreateShareDto {
  @IsIn(['pulse', 'booklist', 'review', 'post', 'book'])
  type: ShareTypeDto;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  targetId: number;
}
