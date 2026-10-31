import { IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotBlank } from '../../../common/validators/custom-validators';

export class CreateCommentDto {
  @ApiProperty({ description: '评论内容' })
  @IsString()
  @IsNotBlank()
  @MaxLength(1000)
  content: string;

  @ApiPropertyOptional({ description: '父评论ID（0 为一级评论）' })
  @IsOptional()
  @IsInt()
  @Min(0)
  parentId?: number;
}