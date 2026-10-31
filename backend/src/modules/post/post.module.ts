import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LibraryModule } from '../library/library.module';
import { CommunityModule } from '../community/community.module';
import { NotificationModule } from '../notification/notification.module';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { FeedService } from './feed.service';
import { Post } from './entities/post.entity';
import { Like } from '../community/entities/like.entity';
import { User } from '../user/entities/user.entity';
import { ReadingSession } from '../reading/entities/reading-session.entity';
import { Review } from '../community/entities/review.entity';
import { Booklist } from '../booklist/entities/booklist.entity';
import { Topic } from '../home/entities/topic.entity';

/** 动态模块：阅读打卡、图文动态、动态流聚合（P2-02 实现） */
@Module({
  imports: [
    TypeOrmModule.forFeature([Post, Like, User, ReadingSession, Review, Booklist, Topic]),
    LibraryModule,
    CommunityModule,
    NotificationModule,
  ],
  controllers: [PostController],
  providers: [PostService, FeedService],
  exports: [PostService, FeedService],
})
export class PostModule {}