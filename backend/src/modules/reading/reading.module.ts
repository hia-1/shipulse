import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LibraryModule } from '../library/library.module';
import { MembershipModule } from '../membership/membership.module';
import { ReadingController } from './reading.controller';
import { ReadingService } from './reading.service';
import { BookshelfController } from './bookshelf.controller';
import { BookshelfService } from './bookshelf.service';
import { Bookshelf } from './entities/bookshelf.entity';
import { ReadingSession } from './entities/reading-session.entity';

/** 阅读模块：书架三态、阅读场次、时脉报告（P1-05/06/07 起实现） */
@Module({
  imports: [
    TypeOrmModule.forFeature([Bookshelf, ReadingSession]),
    LibraryModule,
    MembershipModule,
  ],
  controllers: [ReadingController, BookshelfController],
  providers: [ReadingService, BookshelfService],
  exports: [ReadingService, BookshelfService],
})
export class ReadingModule {}
