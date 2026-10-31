import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { LibraryController } from './library.controller';
import { AdminLibraryController } from './admin-library.controller';
import { BooksService } from './books.service';
import { CategoriesService } from './categories.service';
import { TagsService } from './tags.service';
import { IsbnService } from './isbn.service';
import { Book } from './entities/book.entity';
import { BookTag } from './entities/book-tag.entity';
import { Category } from './entities/category.entity';
import { Tag } from './entities/tag.entity';

/** 书库模块：书籍、分类、标签、ISBN 拉取（P1-01） */
@Module({
  imports: [
    TypeOrmModule.forFeature([Book, BookTag, Category, Tag]),
    AuthModule,
  ],
  controllers: [LibraryController, AdminLibraryController],
  providers: [BooksService, CategoriesService, TagsService, IsbnService],
  exports: [BooksService, CategoriesService, TagsService, IsbnService],
})
export class LibraryModule {}