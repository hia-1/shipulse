import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryBooksDto {
  @ApiPropertyOptional({ description: '页码，从 1 开始', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page: number = 1;

  @ApiPropertyOptional({ description: '每页条数', default: 20, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  pageSize: number = 20;

  @ApiPropertyOptional({ description: '关键词（书名/作者/副标题）' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '分类 ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: '标签 ID' })
  @IsOptional()
  @IsString()
  tagId?: string;

  @ApiPropertyOptional({
    description: '排序：default综合 new新书 hot热门 rating高分',
    enum: ['default', 'new', 'hot', 'rating'],
    default: 'default',
  })
  @IsOptional()
  @IsIn(['default', 'new', 'hot', 'rating'])
  sort: 'default' | 'new' | 'hot' | 'rating' = 'default';
}