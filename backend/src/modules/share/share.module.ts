import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Book } from '../library/entities/book.entity';
import { Review } from '../community/entities/review.entity';
import { Booklist } from '../booklist/entities/booklist.entity';
import { Post } from '../post/entities/post.entity';
import { ReadingSession } from '../reading/entities/reading-session.entity';
import { User } from '../user/entities/user.entity';
import { ShareController } from './share.controller';
import { ShareService } from './share.service';

/** 分享裂变模块：短码映射 + 分享卡片数据（书/书评/书单/动态/时脉） */
@Module({
  imports: [
    TypeOrmModule.forFeature([Book, Review, Booklist, Post, ReadingSession, User]),
  ],
  controllers: [ShareController],
  providers: [ShareService],
  exports: [ShareService],
})
export class ShareModule {}
