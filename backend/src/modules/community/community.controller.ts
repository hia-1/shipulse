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
import { ReviewService } from './review.service';
import { CommentService } from './comment.service';
import { ReportService } from './report.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import {
  SubmitReportDto,
  SubmitAppealDto,
} from './dto/report.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('community')
@ApiBearerAuth('access-token')
@Controller('community')
export class CommunityController {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly commentService: CommentService,
    private readonly reportService: ReportService,
  ) {}

  // ---- 书评 ----

  @Post('reviews')
  @Throttle(10, 60)
  @ApiOperation({ summary: '发布书评（机审通过即发布 / 可疑挂起 / 驳回）' })
  createReview(@CurrentUser('sub') userId: number, @Body() dto: CreateReviewDto) {
    return this.reviewService.create(userId, dto);
  }

  /** 书评列表：须在 @Public 前声明静态段。bookId / userId / keyword 均为可选筛选 */
  @Public()
  @Get('reviews')
  @ApiOperation({ summary: '书评列表（仅已通过；按书/用户/关键词筛选，默认精选+最新/hot/rating 排序）' })
  listReviews(
    @Query('bookId') bookId?: string,
    @Query('userId') userId?: string,
    @Query('keyword') keyword?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.reviewService.list({
      bookId: bookId || undefined,
      userId: userId || undefined,
      keyword: keyword?.trim() || undefined,
      sort,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('reviews/mine')
  @ApiOperation({ summary: '我某本书的书评（任意审核状态）' })
  myReview(@CurrentUser('sub') userId: number, @Query('bookId') bookId: string) {
    return this.reviewService.mine(userId, bookId);
  }

  @Get('reviews/my')
  @ApiOperation({ summary: '我的书评列表（任意审核状态）' })
  myReviewList(
    @CurrentUser('sub') userId: number,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = page ? Number(page) : 1;
    const ps = pageSize ? Number(pageSize) : 10;
    return this.reviewService.myList(
      userId,
      Number.isFinite(p) ? p : 1,
      Number.isFinite(ps) ? ps : 10,
    );
  }

  @Public()
  @Get('reviews/:id')
  @ApiOperation({ summary: '书评详情（已通过；登录可含点赞状态）' })
  reviewDetail(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('sub') viewerId?: number,
  ) {
    return this.reviewService.detail(id, viewerId);
  }

  @Post('reviews/:id/like')
  @Throttle(60, 60)
  @ApiOperation({ summary: '点赞/取消点赞书评' })
  toggleReviewLike(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.reviewService.toggleLike(userId, id);
  }

  @Delete('reviews/:id')
  @Throttle(20, 60)
  @ApiOperation({ summary: '删除自己的书评' })
  removeReview(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.reviewService.remove(userId, id);
  }

  // ---- 书评评论 ----

  @Post('reviews/:id/comments')
  @Throttle(20, 60)
  @ApiOperation({ summary: '发表书评评论（支持两级回复）' })
  createComment(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentService.create(userId, id, dto);
  }

  @Public()
  @Get('reviews/:id/comments')
  @ApiOperation({ summary: '书评评论列表' })
  listComments(@Param('id', ParseIntPipe) id: number) {
    return this.commentService.list(id);
  }

  // ---- 举报 / 申诉（P2-12）----

  @Post('reports')
  @Throttle(10, 60)
  @ApiOperation({ summary: '提交举报（对书评/动态/评论/书单/用户）' })
  submitReport(@CurrentUser('sub') userId: number, @Body() dto: SubmitReportDto) {
    return this.reportService.submitReport(userId, dto);
  }

  @Post('appeals')
  @Throttle(5, 60)
  @ApiOperation({ summary: '提交申诉（对被处罚内容）' })
  submitAppeal(@CurrentUser('sub') userId: number, @Body() dto: SubmitAppealDto) {
    return this.reportService.submitAppeal(userId, dto);
  }

  @Get('appeals/mine')
  @ApiOperation({ summary: '我的申诉列表' })
  myAppeals(
    @CurrentUser('sub') userId: number,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.reportService.myAppeals(
      userId,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 10,
    );
  }
}