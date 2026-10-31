import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AdminLoginDto {
  @IsNotEmpty({ message: '用户名不能为空' })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  username: string;

  @IsNotEmpty({ message: '密码不能为空' })
  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  password: string;
}
