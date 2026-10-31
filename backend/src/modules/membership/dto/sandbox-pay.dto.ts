import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SandboxPayDto {
  @ApiProperty({ description: '订单号' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(32)
  orderNo: string;
}