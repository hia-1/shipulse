import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * 微信小程序一键登录。
 * - code：wx.login 返回的临时登录凭证，用于换取 openid / unionid
 * - phoneCode：getPhoneNumber 返回的手机号凭证（可选，用于绑定手机号并与 Web 账号合并）
 */
export class WechatLoginDto {
  @IsNotEmpty({ message: '微信登录 code 不能为空' })
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  phoneCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  nickname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  avatarUrl?: string;
}
