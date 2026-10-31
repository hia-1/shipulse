import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSessionDto {
  @ApiProperty({ description: '书籍ID' })
  @IsInt()
  @Min(1)
  bookId: number;

  @ApiPropertyOptional({ description: '起始页码', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  startPage?: number;

  @ApiPropertyOptional({ description: '来源', enum: ['web', 'miniprogram'] })
  @IsOptional()
  @IsString()
  source?: string;
}
