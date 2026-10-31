import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsHttpUrl } from '../../../common/validators/custom-validators';

export class CreateBookDto {
  @ApiPropertyOptional({ description: 'ISBN-13（可空，无 ISBN 书可省略）', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  isbn?: string;

  @ApiProperty({ description: '书名', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ description: '副标题' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subtitle?: string;

  @ApiPropertyOptional({ description: '作者（多作者逗号分隔）' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  author?: string;

  @ApiPropertyOptional({ description: '译者' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  translator?: string;

  @ApiPropertyOptional({ description: '出版社' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  publisher?: string;

  @ApiPropertyOptional({ description: '出版日期/年月' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  publishedDate?: string;

  @ApiPropertyOptional({ description: '总页数' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  pages?: number;

  @ApiPropertyOptional({ description: '封面 URL' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  @IsHttpUrl()
  coverUrl?: string;

  @ApiPropertyOptional({ description: '内容简介' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '主分类 ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: '标签 ID 列表' })
  @IsOptional()
  @IsArray()
  tagIds?: string[];

  @ApiPropertyOptional({
    description: '状态：pending待上架 on_shelf已上架 off_shelf已下架',
    default: 'pending',
  })
  @IsOptional()
  @IsString()
  status?: string;
}