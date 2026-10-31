import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: '消息列表（分类 Tab：like/comment/system/all，分页）' })
  list(
    @CurrentUser('sub') userId: number,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.notificationService.list(userId, {
      type,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: '未读数（总数 + 各分类），供角标与 Tab 徽标' })
  unreadCount(@CurrentUser('sub') userId: number) {
    return this.notificationService.unreadCount(userId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: '全部标记已读（可按分类）' })
  markAllRead(@CurrentUser('sub') userId: number, @Query('type') type?: string) {
    return this.notificationService.markAllRead(userId, type);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: '单条标记已读' })
  markRead(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.notificationService.markRead(userId, id);
  }
}