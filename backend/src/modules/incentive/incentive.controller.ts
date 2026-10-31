import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { GoalService } from './goal.service';
import { BadgeService } from './badge.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('incentive')
@ApiBearerAuth('access-token')
@Controller('incentive')
export class IncentiveController {
  constructor(
    private readonly goalService: GoalService,
    private readonly badgeService: BadgeService,
  ) {}

  @Get('goals')
  @ApiOperation({ summary: '获取当前阅读目标（年度+月度）' })
  getGoals(@CurrentUser('sub') userId: number) {
    return this.goalService.getGoals(userId);
  }

  @Post('goals')
  @Throttle(10, 60)
  @ApiOperation({ summary: '设定阅读目标' })
  createGoal(@CurrentUser('sub') userId: number, @Body() dto: CreateGoalDto) {
    return this.goalService.createGoal(userId, dto);
  }

  @Put('goals/:id')
  @Throttle(20, 60)
  @ApiOperation({ summary: '更新阅读目标' })
  updateGoal(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.goalService.updateGoal(userId, id, dto);
  }

  @Get('goals/progress')
  @ApiOperation({ summary: '获取目标进度（含连击信息）' })
  async getProgress(@CurrentUser('sub') userId: number) {
    const [goals, streak] = await Promise.all([
      this.goalService.getProgress(userId),
      this.goalService.getStreak(userId),
    ]);
    return { goals, streak };
  }

  @Get('badges')
  @ApiOperation({ summary: '徽章墙：全部徽章（含解锁状态与进度）' })
  getAllBadges(@CurrentUser('sub') userId: number) {
    return this.badgeService.getAllBadges(userId);
  }

  @Get('badges/mine')
  @ApiOperation({ summary: '我已解锁的徽章' })
  getMyBadges(@CurrentUser('sub') userId: number) {
    return this.badgeService.getMyBadges(userId);
  }

  @Post('badges/check')
  @Throttle(10, 60)
  @ApiOperation({ summary: '触发徽章规则检查并自动发放' })
  checkBadges(@CurrentUser('sub') userId: number) {
    return this.badgeService.checkAndAward(userId);
  }

  @Get('streak')
  @ApiOperation({ summary: '获取连击信息（当前/最长）' })
  getStreak(@CurrentUser('sub') userId: number) {
    return this.goalService.getStreak(userId);
  }
}
