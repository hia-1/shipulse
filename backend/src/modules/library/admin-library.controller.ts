import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminArea } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BooksService } from './books.service';
import { CategoriesService } from './categories.service';
import { TagsService } from './tags.service';
import { IsbnService } from './isbn.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateTagDto } from './dto/create-tag.dto';
import { QueryBooksDto } from './dto/query-books.dto';

@ApiTags('library/admin')
@ApiBearerAuth('access-token')
@AdminArea()
@UseGuards(AdminGuard)
@Controller('library/admin')
export class AdminLibraryController {
  constructor(
    private readonly booksService: BooksService,
    private readonly categoriesService: CategoriesService,
    private readonly tagsService: TagsService,
    private readonly isbnService: IsbnService,
  ) {}

  /** ISBN 第三方拉取书目（失败降级返回 null，提示手动录入） */
  @Get('isbn/:isbn')
  @Throttle(20, 60)
  @ApiOperation({ summary: 'ISBN 拉取书目（失败返回 null）' })
  fetchByIsbn(@Param('isbn') isbn: string) {
    return this.isbnService.fetchByIsbn(isbn);
  }

  /** 管理侧：书籍列表（含待上架） */
  @Get('books')
  @ApiOperation({ summary: '书籍列表（含待上架）' })
  list(@Query() query: QueryBooksDto) {
    return this.booksService.list(query, true);
  }

  @Post('books')
  @Throttle(20, 60)
  @ApiOperation({ summary: '创建书籍' })
  create(
    @Body() dto: CreateBookDto,
    @CurrentUser() user: { sub: number },
  ) {
    return this.booksService.create(dto, user.sub);
  }

  @Put('books/:id')
  @Throttle(30, 60)
  @ApiOperation({ summary: '更新书籍' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBookDto) {
    return this.booksService.update(String(id), dto);
  }

  @Patch('books/:id/publish')
  @ApiOperation({ summary: '上架书籍' })
  publish(@Param('id', ParseIntPipe) id: number) {
    return this.booksService.publish(String(id));
  }

  @Patch('books/:id/off-shelf')
  @ApiOperation({ summary: '下架书籍' })
  offShelf(@Param('id', ParseIntPipe) id: number) {
    return this.booksService.offShelf(String(id));
  }

  @Delete('books/:id')
  @Throttle(20, 60)
  @ApiOperation({ summary: '删除书籍（软删除）' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.booksService.remove(String(id));
  }

  // ---- 分类 ----
  @Post('categories')
  @ApiOperation({ summary: '创建分类' })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Put('categories/:id')
  @ApiOperation({ summary: '更新分类' })
  updateCategory(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.update(String(id), dto);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: '删除分类' })
  removeCategory(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.remove(String(id));
  }

  // ---- 标签 ----
  @Post('tags')
  @ApiOperation({ summary: '创建标签' })
  createTag(@Body() dto: CreateTagDto) {
    return this.tagsService.create(dto);
  }

  @Put('tags/:id')
  @ApiOperation({ summary: '更新标签' })
  updateTag(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateTagDto) {
    return this.tagsService.update(String(id), dto);
  }

  @Delete('tags/:id')
  @ApiOperation({ summary: '删除标签' })
  removeTag(@Param('id', ParseIntPipe) id: number) {
    return this.tagsService.remove(String(id));
  }
}