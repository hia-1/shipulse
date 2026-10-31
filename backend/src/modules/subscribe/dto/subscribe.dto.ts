import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthorizeSubscribeDto {
  @ApiProperty({ description: '本次授权通过的模板ID列表', type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  templateIds: string[];
}

export class SendSubscribeDto {
  @ApiProperty({ description: '订阅消息模板ID' })
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @ApiPropertyOptional({ description: '点击消息跳转的小程序页面路径' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  page?: string;

  @ApiPropertyOptional({ description: '模板数据（键值对，随模板字段而定）' })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
