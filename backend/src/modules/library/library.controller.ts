import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BooksService } from './books.service';
import { CategoriesService } from './categories.service';
import { TagsService } from './tags.service';
import { QueryBooksDto } from './dto/query-books.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('library')
@Controller('library')
export class LibraryController {
  constructor(
    private readonly booksService: BooksService,
    private readonly categoriesService: CategoriesService,
    private readonly tagsService: TagsService,
  ) {}

  @Public()
  @Get('ping')
  ping() {
    return { module: 'library', status: 'ok' };
  }

  /** 分类树（两级） */
  @Public()
  @Get('categories')
  @ApiOperation({ summary: '分类树' })
  categories() {
    return this.categoriesService.tree();
  }

  /** 标签列表 */
  @Public()
  @Get('tags')
  @ApiOperation({ summary: '标签列表' })
  tags() {
    return this.tagsService.list();
  }

  /** 书籍列表（分页/筛选/排序；仅已上架） */
  @Public()
  @Get('books')
  @ApiOperation({ summary: '书籍列表' })
  list(@Query() query: QueryBooksDto) {
    return this.booksService.list(query, false);
  }

  /** 按 ISBN 精确查 */
  @Public()
  @Get('books/isbn/:isbn')
  @ApiOperation({ summary: '按 ISBN 查询书籍' })
  findByIsbn(@Param('isbn') isbn: string) {
    return this.booksService.findByIsbn(isbn);
  }

  /** 书籍详情 */
  @Public()
  @Get('books/:id')
  @ApiOperation({ summary: '书籍详情' })
  detail(@Param('id') id: string) {
    return this.booksService.detail(id, false);
  }
}