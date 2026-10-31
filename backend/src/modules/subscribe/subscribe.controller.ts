import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SubscribeService } from './subscribe.service';
import { AuthorizeSubscribeDto, SendSubscribeDto } from './dto/subscribe.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('subscribe')
@Controller('subscribe')
export class SubscribeController {
  constructor(private readonly subscribeService: SubscribeService) {}

  @Public()
  @Get('templates')
  @ApiOperation({ summary: '可用订阅消息模板（供小程序授权弹窗）' })
  templates() {
    return this.subscribeService.templates();
  }

  @ApiBearerAuth('access-token')
  @Get('status')
  @ApiOperation({ summary: '我的订阅授权状态（模板 + 授权额度）' })
  status(@CurrentUser('sub') userId: number) {
    return this.subscribeService.status(userId);
  }

  @ApiBearerAuth('access-token')
  @Post('authorize')
  @Throttle(30, 60)
  @ApiOperation({ summary: '记录订阅消息授权（累加可下发额度）' })
  authorize(
    @CurrentUser('sub') userId: number,
    @Body() dto: AuthorizeSubscribeDto,
  ) {
    return this.subscribeService.authorize(userId, dto.templateIds);
  }

  @ApiBearerAuth('access-token')
  @Post('send')
  @Throttle(10, 60)
  @ApiOperation({ summary: '下发一条订阅消息（消耗一次授权额度）' })
  send(@CurrentUser('sub') userId: number, @Body() dto: SendSubscribeDto) {
    return this.subscribeService.send(userId, dto);
  }
}
