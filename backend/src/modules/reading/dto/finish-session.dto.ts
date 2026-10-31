import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FinishSessionDto {
  @ApiPropertyOptional({ description: '结束页码', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  endPage?: number;

  @ApiPropertyOptional({ description: '笔记摘抄', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({ description: '实际阅读时长（秒，扣除暂停后）。不传则按结束-开始计算', minimum: 0, maximum: 86400 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  durationSeconds?: number;
}
