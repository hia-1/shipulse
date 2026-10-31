import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsHttpUrl, IsNotBlank } from '../../../common/validators/custom-validators';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: '昵称' })
  @IsOptional()
  @IsString()
  @IsNotBlank()
  @MaxLength(64)
  nickname?: string;

  @ApiPropertyOptional({ description: '头像URL' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  @IsHttpUrl()
  avatarUrl?: string;

  @ApiPropertyOptional({ description: '性别：0未知 1男 2女' })
  @IsOptional()
  @IsIn([0, 1, 2])
  gender?: number;

  @ApiPropertyOptional({ description: '个人简介' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  bio?: string;
}