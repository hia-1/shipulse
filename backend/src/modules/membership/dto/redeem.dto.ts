import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RedeemDto {
  @ApiProperty({ description: '兑换码' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(32)
  code: string;
}