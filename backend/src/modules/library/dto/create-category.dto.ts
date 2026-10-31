import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsHttpUrl } from '../../../common/validators/custom-validators';

export class CreateCategoryDto {
  @ApiProperty({ description: '分类名称', maxLength: 64 })
  @IsString()
  @MaxLength(64)
  name: string;

  @ApiPropertyOptional({ description: '父分类 ID，0 为一级', default: 0 })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ description: '分类图标 URL' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  @IsHttpUrl()
  iconUrl?: string;

  @ApiPropertyOptional({ description: '排序', default: 0 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  sort?: number;

  @ApiPropertyOptional({ description: '状态：enabled启用 disabled停用' })
  @IsOptional()
  @IsIn(['enabled', 'disabled'])
  status?: 'enabled' | 'disabled';
}