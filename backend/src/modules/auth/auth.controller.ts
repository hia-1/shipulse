import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { WechatLoginDto } from './dto/wechat-login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('auth')
@ApiBearerAuth('access-token')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle(10, 60)
  @Post('register')
  @ApiOperation({ summary: '用户注册（手机号 + 验证码）' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle(10, 60)
  @Post('login')
  @ApiOperation({ summary: '用户登录（手机号 + 验证码）' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Throttle(10, 60)
  @Post('wechat')
  @ApiOperation({
    summary: '微信小程序一键登录（code + 可选手机号凭证，按手机号合并账号）',
  })
  wechatLogin(@Body() dto: WechatLoginDto) {
    return this.authService.wechatLogin(dto);
  }

  @Public()
  @Throttle(20, 60)
  @Post('refresh')
  @ApiOperation({ summary: '刷新令牌（AccessToken + RefreshToken）' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @ApiOperation({ summary: '退出登录（服务端使该账号已签发令牌立即失效）' })
  logout(@CurrentUser('sub') userId: number) {
    return this.authService.logout(userId);
  }
}
