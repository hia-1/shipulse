import { IsBoolean, IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({ description: '套餐ID' })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  planId: number;

  @ApiPropertyOptional({ description: '是否自动续费' })
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}