import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../user/user.module';
import { MembershipController } from './membership.controller';
import { MembershipService } from './membership.service';
import { MembershipPlan } from './entities/membership-plan.entity';
import { MembershipOrder } from './entities/order.entity';
import { MemberSubscription } from './entities/member-subscription.entity';
import { PaymentRecord } from './entities/payment-record.entity';
import { RedeemCode } from './entities/redeem-code.entity';
import { Notification } from './entities/notification.entity';

/** 会员模块：订阅、支付、权益、自动续费、到期提醒（P1-11） */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      MembershipPlan,
      MembershipOrder,
      MemberSubscription,
      PaymentRecord,
      RedeemCode,
      Notification,
    ]),
    UserModule,
  ],
  controllers: [MembershipController],
  providers: [MembershipService],
  exports: [MembershipService],
})
export class MembershipModule {}