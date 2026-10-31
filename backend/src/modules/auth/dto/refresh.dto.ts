import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshDto {
  @IsNotEmpty({ message: 'refreshToken 不能为空' })
  @IsString()
  refreshToken: string;
}
