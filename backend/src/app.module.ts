import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { HealthModule } from './health/health.module';
import { UserModule } from './modules/user/user.module';
import { LibraryModule } from './modules/library/library.module';
import { ReadingModule } from './modules/reading/reading.module';
import { CommunityModule } from './modules/community/community.module';
import { HomeModule } from './modules/home/home.module';
import { MembershipModule } from './modules/membership/membership.module';
import { BooklistModule } from './modules/booklist/booklist.module';
import { PostModule } from './modules/post/post.module';
import { SearchModule } from './modules/search/search.module';
import { IncentiveModule } from './modules/incentive/incentive.module';
import { AdminModule } from './modules/admin/admin.module';
import { EventModule } from './modules/event/event.module';
import { NotificationModule } from './modules/notification/notification.module';
import { ShareModule } from './modules/share/share.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { SubscribeModule } from './modules/subscribe/subscribe.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuthStateModule } from './common/auth-state/auth-state.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import config from './config';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `../.env.${process.env.NODE_ENV || 'dev'}`,
      isGlobal: true,
      load: [config],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.database'),
        autoLoadEntities: true,
        synchronize: false,
        timezone: configService.get('database.timezone'),
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ttl: configService.get('throttler.ttl'),
        limit: configService.get('throttler.limit'),
      }),
    }),
    HealthModule,
    AuthStateModule,
    AuthModule,
    UserModule,
    LibraryModule,
    SearchModule,
    ReadingModule,
    CommunityModule,
    HomeModule,
    MembershipModule,
    BooklistModule,
    PostModule,
    IncentiveModule,
    AdminModule,
    EventModule,
    NotificationModule,
    ShareModule,
    FeedbackModule,
    SubscribeModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
