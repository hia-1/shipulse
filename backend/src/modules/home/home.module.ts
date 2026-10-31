import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
// eslint-disable-next-line import/no-unresolved
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { LibraryModule } from '../library/library.module';
import { Banner } from './entities/banner.entity';
import { ColumnItem } from './entities/column.entity';
import { Review } from '../community/entities/review.entity';
import { User } from '../user/entities/user.entity';
import { Book } from '../library/entities/book.entity';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { RankService, REDIS_CLIENT } from './rank.service';

/** 首页（发现式）：Banner/每周好书/榜单（Redis 热榜，可降级 MySQL）/热门书评（P1-09） */
@Module({
  imports: [
    TypeOrmModule.forFeature([Banner, ColumnItem, Review, User, Book]),
    LibraryModule,
  ],
  controllers: [HomeController],
  providers: [
    HomeService,
    RankService,
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const client = new Redis({
          host: config.get('redis.host'),
          port: Number(config.get('redis.port')),
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          // 连接失败不无限重试，交由 RankService 降级到 MySQL
          retryStrategy: () => null,
        });
        void client.connect().catch(() => undefined);
        return client;
      },
    },
  ],
  exports: [HomeService, RankService],
})
export class HomeModule {}