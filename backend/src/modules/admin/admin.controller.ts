import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminService } from './admin.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { Public, AdminArea } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminGuard } from '../../common/guards/admin.guard';

@ApiTags('admin')
@ApiBearerAuth('access-token')
// 整类强制管理员身份；@Public 的 ping/login 由守卫放行，profile 等接口必须是 admin 令牌
@AdminArea()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Public()
  @Get('ping')
  ping() {
    return this.adminService.ping();
  }

  @Public()
  @Throttle(10, 60)
  @Post('login')
  @ApiOperation({ summary: '管理员登录（用户名 + 密码）' })
  login(@Body() dto: AdminLoginDto) {
    return this.adminService.login(dto);
  }

  @Get('profile')
  @ApiOperation({ summary: '获取当前管理员信息' })
  profile(@CurrentUser() user: { sub: number }) {
    return this.adminService.getProfile(user.sub);
  }
}
