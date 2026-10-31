import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotBlank } from '../../../common/validators/custom-validators';

export class CreateReviewDto {
  @ApiProperty({ description: '书籍ID' })
  @IsInt()
  @Min(1)
  bookId: number;

  @ApiProperty({ description: '评分 0.5-5.0（半星步进）' })
  @IsNumber()
  @Min(0.5)
  @Max(5)
  rating: number;

  @ApiProperty({ description: '书评标题' })
  @IsString()
  @IsNotBlank()
  @MaxLength(255)
  title: string;

  @ApiProperty({ description: '书评正文', required: false })
  @IsOptional()
  @IsString()
  @IsNotBlank()
  @MinLength(1)
  @MaxLength(20000)
  content?: string;
}