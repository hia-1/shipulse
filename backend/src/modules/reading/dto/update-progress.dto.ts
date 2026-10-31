import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProgressDto {
  @ApiProperty({ description: '当前页码', minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  currentPage: number;

  @ApiProperty({ description: '阅读进度百分比 0-100', minimum: 0, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  progress: number;
}
