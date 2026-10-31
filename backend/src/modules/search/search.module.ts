import { Module } from '@nestjs/common';
// eslint-disable-next-line import/no-unresolved
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { LibraryModule } from '../library/library.module';
import { AuthModule } from '../auth/auth.module';
import { SearchController } from './search.controller';
import { SearchService, REDIS_CLIENT } from './search.service';
import { SuggestService } from './suggest.service';

/** 搜索模块：联想 / 热搜（Redis，可降级内存）/ 记录（P1-03） */
@Module({
  imports: [LibraryModule, AuthModule],
  controllers: [SearchController],
  providers: [
    SearchService,
    SuggestService,
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
          // 连接失败不无限重试，交由 SearchService 降级到内存
          retryStrategy: () => null,
        });
        // 异步建连，失败不阻塞模块启动，SearchService 通过 status 判断可用性
        void client.connect().catch(() => undefined);
        return client;
      },
    },
  ],
  exports: [SearchService, SuggestService],
})
export class SearchModule {}