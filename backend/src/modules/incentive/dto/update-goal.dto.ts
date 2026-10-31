import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// 上限用于防止超大数值溢出目标表 int unsigned 列
export class UpdateGoalDto {
  @ApiPropertyOptional({ description: '目标时长（分钟）', minimum: 0, maximum: 1000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  targetMinutes?: number;

  @ApiPropertyOptional({ description: '目标读完本数', minimum: 0, maximum: 100000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  targetBooks?: number;
}
