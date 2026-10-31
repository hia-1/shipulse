import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsHttpUrl } from '../../../common/validators/custom-validators';

export class UpdateBooklistDto {
  @ApiPropertyOptional({ description: '书单标题' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  title?: string;

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
}

export class AddBookItemDto {
  @ApiPropertyOptional({ description: '图书ID' })
  @IsOptional()
  @IsString()
  bookId?: string;

  @ApiPropertyOptional({ description: '推荐语' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}