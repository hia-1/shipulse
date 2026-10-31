import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscribeController } from './subscribe.controller';
import { SubscribeService } from './subscribe.service';
import { SubscribeAuthorization } from './entities/subscribe-authorization.entity';
import { UserAuth } from '../user/entities/user-auth.entity';

/** 订阅消息模块：模板查询、授权记录、下发（P2-08 小程序订阅消息接入） */
@Module({
  imports: [TypeOrmModule.forFeature([SubscribeAuthorization, UserAuth])],
  controllers: [SubscribeController],
  providers: [SubscribeService],
  exports: [SubscribeService],
})
export class SubscribeModule {}
