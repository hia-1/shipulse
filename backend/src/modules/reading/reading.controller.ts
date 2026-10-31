import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ReadingService } from './reading.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { FinishSessionDto } from './dto/finish-session.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('reading')
@ApiBearerAuth('access-token')
@Controller('reading')
export class ReadingController {
  constructor(private readonly readingService: ReadingService) {}

  @Public()
  @Get('ping')
  ping() {
    return this.readingService.ping();
  }

  @Post('sessions')
  @Throttle(20, 60)
  @ApiOperation({ summary: '开始阅读场次（手动计时开始）' })
  startSession(
    @CurrentUser('sub') userId: number,
    @Body() dto: CreateSessionDto,
  ) {
    return this.readingService.createSession(userId, dto);
  }

  @Patch('sessions/:id/finish')
  @Throttle(30, 60)
  @ApiOperation({ summary: '结束阅读场次（填写页码/笔记，计算时长）' })
  finishSession(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) sessionId: number,
    @Body() dto: FinishSessionDto,
  ) {
    return this.readingService.finishSession(userId, sessionId, dto);
  }

  @Get('sessions/ongoing')
  @ApiOperation({ summary: '获取当前进行中的场次（页面刷新恢复用）' })
  getOngoing(@CurrentUser('sub') userId: number) {
    return this.readingService.getOngoingSession(userId);
  }

  @Get('sessions/today-summary')
  @ApiOperation({ summary: '今日阅读概览' })
  getTodaySummary(@CurrentUser('sub') userId: number) {
    return this.readingService.getTodaySummary(userId);
  }

  @Get('sessions')
  @ApiOperation({ summary: '我的阅读场次列表' })
  listSessions(
    @CurrentUser('sub') userId: number,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = page ? Number(page) : 1;
    const ps = pageSize ? Number(pageSize) : 20;
    return this.readingService.listSessions(
      userId,
      Number.isFinite(p) ? p : 1,
      Number.isFinite(ps) ? ps : 20,
    );
  }

  @Get('pulse/daily')
  @ApiOperation({ summary: '按日聚合阅读时长（时脉图表数据源）' })
  getDailyDurations(
    @CurrentUser('sub') userId: number,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const now = new Date();
    const startDate = start ? new Date(start) : new Date(now.getFullYear(), 0, 1);
    const endDate = end ? new Date(end) : new Date(now.getFullYear() + 1, 0, 1);
    return this.readingService.getDailyDurations(userId, startDate, endDate);
  }

  @Get('pulse/annual')
  @ApiOperation({ summary: '年度盘点' })
  getAnnualReview(
    @CurrentUser('sub') userId: number,
    @Query('year') year?: string,
  ) {
    const y = year ? Number(year) : new Date().getFullYear();
    return this.readingService.getAnnualReview(userId, y);
  }

  @Get('pulse/export')
  @Throttle(5, 60)
  @ApiOperation({ summary: '导出阅读场次 CSV（会员功能）' })
  async exportCsv(@CurrentUser('sub') userId: number) {
    const csv = await this.readingService.exportSessionsCsv(userId);
    return { csv };
  }
}
