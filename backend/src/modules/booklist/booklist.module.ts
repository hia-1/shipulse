import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LibraryModule } from '../library/library.module';
import { CommunityModule } from '../community/community.module';
import { BooklistController } from './booklist.controller';
import { BooklistService } from './booklist.service';
import { Booklist } from './entities/booklist.entity';
import { BooklistItem } from './entities/booklist-item.entity';
import { Like } from '../community/entities/like.entity';
import { User } from '../user/entities/user.entity';

/** 书单模块：创建/编辑/加书/收藏/广场/详情（P2-01 实现） */
@Module({
  imports: [
    TypeOrmModule.forFeature([Booklist, BooklistItem, Like, User]),
    LibraryModule,
    CommunityModule,
  ],
  controllers: [BooklistController],
  providers: [BooklistService],
  exports: [BooklistService],
})
export class BooklistModule {}