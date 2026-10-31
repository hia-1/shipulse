import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LibraryModule } from '../library/library.module';
import { NotificationModule } from '../notification/notification.module';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { ReviewService } from './review.service';
import { CommentService } from './comment.service';
import { ModerationService } from './moderation.service';
import { ReportService } from './report.service';
import { Review } from './entities/review.entity';
import { Comment } from './entities/comment.entity';
import { Like } from './entities/like.entity';
import { ModerationLog } from './entities/moderation-log.entity';
import { Report } from './entities/report.entity';
import { Appeal } from './entities/appeal.entity';
import { Notification } from './entities/notification.entity';
import { Post } from '../post/entities/post.entity';
import { Booklist } from '../booklist/entities/booklist.entity';
import { User } from '../user/entities/user.entity';

/** 社区模块：书评、评论、点赞、机审状态机、举报申诉（P1-08 / P2-12） */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Review,
      Comment,
      Like,
      ModerationLog,
      Report,
      Appeal,
      Notification,
      Post,
      Booklist,
      User,
    ]),
    LibraryModule,
    NotificationModule,
  ],
  controllers: [CommunityController],
  providers: [
    CommunityService,
    ReviewService,
    CommentService,
    ModerationService,
    ReportService,
  ],
  exports: [ReviewService, CommentService, ModerationService, ReportService],
})
export class CommunityModule {}
