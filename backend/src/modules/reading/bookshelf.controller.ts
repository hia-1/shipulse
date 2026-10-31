import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BookshelfService } from './bookshelf.service';
import { SetShelfDto } from './dto/set-shelf.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/** 个人书架：想读/在读/已读三态（受保护，需登录）P1-04/05 */
@ApiTags('bookshelf')
@ApiBearerAuth('access-token')
@Controller('bookshelf')
export class BookshelfController {
  constructor(private readonly service: BookshelfService) {}

  @Get()
  @ApiOperation({ summary: '我的书架列表（可按三态过滤）' })
  list(
    @CurrentUser('sub') userId: number,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    const p = page ? Number(page) : 1;
    const ps = pageSize ? Number(pageSize) : 20;
    const validStatuses = ['want', 'reading', 'read'];
    const st =
      status && validStatuses.includes(status)
        ? (status as 'want' | 'reading' | 'read')
        : undefined;
    return this.service.list(
      userId,
      Number.isFinite(p) ? p : 1,
      Number.isFinite(ps) ? ps : 20,
      st,
    );
  }

  @Get('status/:bookId')
  @ApiOperation({ summary: '我对某本书的书架状态' })
  status(
    @CurrentUser('sub') userId: number,
    @Param('bookId', ParseIntPipe) bookId: number,
  ) {
    return this.service.getStatus(userId, String(bookId));
  }

  @Put(':bookId')
  @ApiOperation({ summary: '三态切换：想读/在读/已读（互斥）' })
  set(
    @CurrentUser('sub') userId: number,
    @Param('bookId', ParseIntPipe) bookId: number,
    @Body() dto: SetShelfDto,
  ) {
    return this.service.setStatus(userId, String(bookId), dto.status);
  }

  @Patch(':bookId/progress')
  @ApiOperation({ summary: '更新阅读进度' })
  updateProgress(
    @CurrentUser('sub') userId: number,
    @Param('bookId', ParseIntPipe) bookId: number,
    @Body() dto: UpdateProgressDto,
  ) {
    return this.service.updateProgress(
      userId,
      String(bookId),
      dto.currentPage,
      dto.progress,
    );
  }

  @Delete(':bookId')
  @ApiOperation({ summary: '移出书架' })
  remove(
    @CurrentUser('sub') userId: number,
    @Param('bookId', ParseIntPipe) bookId: number,
  ) {
    return this.service.remove(userId, String(bookId));
  }
}
