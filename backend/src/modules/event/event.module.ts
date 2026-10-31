import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from './entities/event.entity';
import { EventSignup } from './entities/event-signup.entity';
import { User } from '../user/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { EventController } from './event.controller';
import { EventAdminController } from './event-admin.controller';
import { EventService } from './event.service';

/** 活动/共读营模块（P2-15）：用户报名 + 管理端全生命周期管理 */
@Module({
  imports: [TypeOrmModule.forFeature([Event, EventSignup, User]), AuthModule],
  controllers: [EventController, EventAdminController],
  providers: [EventService],
  exports: [EventService],
})
export class EventModule {}
