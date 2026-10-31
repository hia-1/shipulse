import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsHttpUrl, IsNotBlank } from '../../../common/validators/custom-validators';

export class CreateBooklistDto {
  @ApiProperty({ description: '书单标题' })
  @IsString()
  @IsNotBlank()
  @MinLength(1)
  @MaxLength(128)
  title: string;

  @ApiPropertyOptional({ description: '书单简介' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: '书单封面URL' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  @IsHttpUrl()
  coverUrl?: string;

  @ApiPropertyOptional({ description: '初始收录的图书ID列表' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  bookIds?: number[];
}