import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PostService } from './post.service';
import { FeedService, FeedSort } from './feed.service';
import { CreateCheckinDto, CreateTextPostDto } from './dto/create-post.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('posts')
@ApiBearerAuth('access-token')
@Controller()
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly feedService: FeedService,
  ) {}

  // ---- 动态流（聚合打卡/图文/书评/书单） ----

  @Public()
  @Get('feed/topics')
  @ApiOperation({ summary: '活跃话题列表（供动态流筛选 chips）' })
  feedTopics() {
    return this.feedService.topics();
  }

  @Public()
  @Get('feed')
  @ApiOperation({ summary: '动态流：单信息流，热门/最新 + 打卡/图文/书评/书单筛选' })
  feed(
    @Query('type') type?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('topicId') topicId?: string,
    @CurrentUser('sub') userId?: number,
  ) {
    return this.feedService.feed({
      type: type as any,
      sort: sort as FeedSort,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      topicId: topicId ? Number(topicId) : undefined,
      userId,
    });
  }

  // ---- 动态发布 ----

  @Post('posts/checkin')
  @Throttle(10, 60)
  @ApiOperation({ summary: '阅读打卡：关联当日阅读场次，每日一次防重复' })
  createCheckin(@CurrentUser('sub') userId: number, @Body() dto: CreateCheckinDto) {
    return this.postService.createCheckin(userId, dto);
  }

  @Post('posts')
  @Throttle(10, 60)
  @ApiOperation({ summary: '发布图文动态（走机审，可疑挂起/驳回）' })
  createText(@CurrentUser('sub') userId: number, @Body() dto: CreateTextPostDto) {
    return this.postService.createText(userId, dto);
  }

  // ---- 状态与我的 ----

  @Get('posts/today')
  @ApiOperation({ summary: '今日打卡状态与今日阅读时长（打卡按钮态）' })
  todayStatus(@CurrentUser('sub') userId: number) {
    return this.postService.todayStatus(userId);
  }

  @Get('posts/my')
  @ApiOperation({ summary: '我的动态列表（任意审核状态，供个人中心）' })
  myPosts(
    @CurrentUser('sub') userId: number,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = page ? Number(page) : 1;
    const ps = pageSize ? Number(pageSize) : 10;
    return this.postService.myPosts(
      userId,
      Number.isFinite(p) ? p : 1,
      Number.isFinite(ps) ? ps : 10,
    );
  }

  // ---- 详情 / 点赞 / 删除 ----

  @Public()
  @Get('posts/:id')
  @ApiOperation({ summary: '动态详情（仅已通过；登录可带点赞状态）' })
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser('sub') viewerId?: number) {
    return this.postService.detail(id, viewerId);
  }

  @Post('posts/:id/like')
  @Throttle(60, 60)
  @ApiOperation({ summary: '点赞/取消点赞动态' })
  toggleLike(@CurrentUser('sub') userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.postService.toggleLike(userId, id);
  }

  @Delete('posts/:id')
  @Throttle(20, 60)
  @ApiOperation({ summary: '删除自己的动态' })
  remove(@CurrentUser('sub') userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.postService.remove(userId, id);
  }
}