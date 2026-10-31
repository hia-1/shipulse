import {
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGoalDto {
  @ApiProperty({ description: '目标类型：yearly年度 / monthly月度', enum: ['yearly', 'monthly'] })
  @IsIn(['yearly', 'monthly'])
  goalType: 'yearly' | 'monthly';

  @ApiPropertyOptional({ description: '周期（yearly: 2026 / monthly: 2026-09），不传则取当前周期' })
  @IsOptional()
  @IsIn(['yearly', 'monthly'])
  period?: string;

  @ApiPropertyOptional({ description: '目标时长（分钟）', default: 0, maximum: 1000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  targetMinutes?: number;

  @ApiPropertyOptional({ description: '目标读完本数', default: 0, maximum: 100000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  targetBooks?: number;
}
