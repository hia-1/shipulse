import { IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CancelAccountDto {
  @ApiProperty({ description: '注销确认（须为 true）' })
  @IsBoolean()
  @IsNotEmpty()
  confirm: boolean;
}