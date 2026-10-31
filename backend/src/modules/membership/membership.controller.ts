import { Body, Controller, ForbiddenException, Get, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MembershipService } from './membership.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { SandboxPayDto } from './dto/sandbox-pay.dto';
import { RedeemDto } from './dto/redeem.dto';

@ApiTags('membership')
@ApiBearerAuth('access-token')
@Controller('membership')
export class MembershipController {
  constructor(
    private readonly membershipService: MembershipService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get('ping')
  ping() {
    return { module: 'membership', status: 'active' };
  }

  @Public()
  @Get('plans')
  @ApiOperation({ summary: '会员套餐列表（上架中）' })
  listPlans() {
    return this.membershipService.listPlans();
  }

  @Post('orders')
  @Throttle(10, 60)
  @ApiOperation({ summary: '创建会员订单' })
  createOrder(@CurrentUser('sub') userId: number, @Body() dto: CreateOrderDto) {
    return this.membershipService.createOrder(userId, dto);
  }

  @Post('pay/sandbox')
  @Throttle(10, 60)
  @ApiOperation({ summary: '沙箱模拟支付回调（正式替换为微信支付异步通知）' })
  sandboxPay(@CurrentUser('sub') userId: number, @Body() dto: SandboxPayDto) {
    // 沙箱支付仅允许显式声明为开发环境，NODE_ENV 未设置（可能为误部署）时一律拒绝
    if (!this.configService.get<boolean>('isDev')) {
      throw new ForbiddenException('沙箱支付接口仅限显式开发环境');
    }
    return this.membershipService.sandboxPay(userId, dto.orderNo);
  }

  @Get('my')
  @ApiOperation({ summary: '我的会员状态与可购套餐' })
  myStatus(@CurrentUser('sub') userId: number) {
    return this.membershipService.myStatus(userId);
  }

  @Get('orders')
  @ApiOperation({ summary: '我的订单记录' })
  myOrders(
    @CurrentUser('sub') userId: number,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = page ? Number(page) : 1;
    const ps = pageSize ? Number(pageSize) : 10;
    return this.membershipService.myOrders(
      userId,
      Number.isFinite(p) ? p : 1,
      Number.isFinite(ps) ? ps : 10,
    );
  }

  @Post('trial')
  @Throttle(3, 60)
  @ApiOperation({ summary: '新用户试用（7 天，仅一次）' })
  trial(@CurrentUser('sub') userId: number) {
    return this.membershipService.trial(userId);
  }

  @Post('redeem')
  @Throttle(5, 60) // 防兑换码爆破
  @ApiOperation({ summary: '兑换码核销（一次性）' })
  redeem(@CurrentUser('sub') userId: number, @Body() dto: RedeemDto) {
    return this.membershipService.redeem(userId, dto.code);
  }
}