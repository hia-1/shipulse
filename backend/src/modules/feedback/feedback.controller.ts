import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FeedbackService } from './feedback.service';
import { FeedbackQueryDto, SubmitFeedbackDto } from './dto/feedback.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('feedback')
@ApiBearerAuth('access-token')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @Throttle(5, 60)
  @ApiOperation({ summary: '提交意见反馈（登录用户）' })
  submit(@CurrentUser('sub') userId: number, @Body() dto: SubmitFeedbackDto) {
    return this.feedbackService.submit(userId, dto);
  }

  @Get('mine')
  @ApiOperation({ summary: '我的反馈记录（分页）' })
  mine(@CurrentUser('sub') userId: number, @Query() query: FeedbackQueryDto) {
    return this.feedbackService.mine(userId, query.page, query.size);
  }
}
