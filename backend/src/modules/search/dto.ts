import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecordSearchDto {
  @ApiProperty({ description: '搜索关键词' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  keyword: string;
}

export class SuggestQueryDto {
  @ApiProperty({ description: '输入关键词' })
  @IsString()
  @MaxLength(60)
  keyword?: string;

  @ApiPropertyOptional({ description: '联想条数', default: 8, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  limit?: number = 8;
}