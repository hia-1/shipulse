import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BooklistService } from './booklist.service';
import { Public, OptionalAuth } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateBooklistDto } from './dto/create-booklist.dto';
import { UpdateBooklistDto, AddBookItemDto } from './dto/add-book-item.dto';

@ApiTags('booklists')
@ApiBearerAuth('access-token')
@Controller('booklists')
export class BooklistController {
  constructor(private readonly booklistService: BooklistService) {}

  @OptionalAuth()
  @Get('square')
  @ApiOperation({ summary: '书单广场（主题标签筛选/排序/搜索）' })
  square(
    @CurrentUser('sub') userId: number | undefined,
    @Query('tag') tag?: string,
    @Query('q') q?: string,
    @Query('sort') sort?: 'hot' | 'newest',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.booklistService.square({
      tag,
      q,
      sort,
      userId,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 12,
    });
  }

  @Public()
  @Get('tags')
  @ApiOperation({ summary: '广场主题标签元信息' })
  tags() {
    return this.booklistService.tagsMeta();
  }

  @Get('my')
  @ApiOperation({ summary: '我创建与收藏的书单' })
  my(@CurrentUser('sub') userId: number) {
    return this.booklistService.myList(userId);
  }

  @OptionalAuth()
  @Get('book/:bookId')
  @ApiOperation({ summary: '收录了某书的书单（书籍详情页模块）' })
  byBook(
    @CurrentUser('sub') userId: number | undefined,
    @Param('bookId', ParseIntPipe) bookId: number,
  ) {
    return this.booklistService.byBook(bookId, userId ?? null);
  }

  @OptionalAuth()
  @Get(':id')
  @ApiOperation({ summary: '书单详情（书目/创建者/收藏数）' })
  detail(
    @CurrentUser('sub') userId: number | undefined,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.booklistService.detail(userId ?? null, id);
  }

  @Post()
  @Throttle(10, 60)
  @ApiOperation({ summary: '创建书单（可含初始书目）' })
  create(@CurrentUser('sub') userId: number, @Body() dto: CreateBooklistDto) {
    return this.booklistService.create(userId, dto);
  }

  @Patch(':id')
  @Throttle(20, 60)
  @ApiOperation({ summary: '编辑书单（仅创建者）' })
  update(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBooklistDto,
  ) {
    return this.booklistService.update(userId, id, dto);
  }

  @Delete(':id')
  @Throttle(20, 60)
  @ApiOperation({ summary: '删除书单（软删除）' })
  remove(@CurrentUser('sub') userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.booklistService.remove(userId, id);
  }

  @Post(':id/items')
  @Throttle(30, 60)
  @ApiOperation({ summary: '向书单加入图书' })
  addBook(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddBookItemDto,
  ) {
    return this.booklistService.addBook(userId, id, dto);
  }

  @Delete(':id/items/:bookId')
  @Throttle(30, 60)
  @ApiOperation({ summary: '从书单移除图书' })
  removeBook(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('bookId', ParseIntPipe) bookId: number,
  ) {
    return this.booklistService.removeBook(userId, id, bookId);
  }

  @Post(':id/collect')
  @Throttle(60, 60)
  @ApiOperation({ summary: '收藏书单' })
  collect(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.booklistService.collect(userId, id);
  }

  @Delete(':id/collect')
  @Throttle(60, 60)
  @ApiOperation({ summary: '取消收藏书单' })
  uncollect(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.booklistService.uncollect(userId, id);
  }
}