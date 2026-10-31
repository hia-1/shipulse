import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { Notification } from '../community/entities/notification.entity';
import { User } from '../user/entities/user.entity';

/** 消息中心模块（P2-04）：站内通知读取与触发落库 */
@Module({
  imports: [TypeOrmModule.forFeature([Notification, User])],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}