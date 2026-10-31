import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateTagDto {
  @ApiProperty({ description: '标签名', maxLength: 64 })
  @IsString()
  @MaxLength(64)
  name: string;

  @ApiPropertyOptional({ description: '状态：on启用 off停用' })
  @IsOptional()
  @IsIn(['on', 'off'])
  status?: 'on' | 'off';
}