import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserService } from './user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CancelAccountDto } from './dto/cancel-account.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('user')
@ApiBearerAuth('access-token')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Public()
  @Get('ping')
  ping() {
    return this.userService.ping();
  }

  @Get('profile')
  @ApiOperation({ summary: '获取当前登录用户信息' })
  profile(@CurrentUser() user: { sub: number }) {
    return this.userService.getProfile(user.sub);
  }

  @Patch('profile')
  @Throttle(20, 60)
  @ApiOperation({ summary: '编辑个人资料' })
  updateProfile(
    @CurrentUser() user: { sub: number },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(user.sub, dto);
  }

  @Post('account/cancel')
  @Throttle(3, 60)
  @ApiOperation({ summary: '注销账号（须确认）' })
  cancelAccount(
    @CurrentUser() user: { sub: number },
    @Body() dto: CancelAccountDto,
  ) {
    return this.userService.cancelAccount(user.sub, dto);
  }
}
