import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncentiveController } from './incentive.controller';
import { GoalService } from './goal.service';
import { BadgeService } from './badge.service';
import { ReadingGoal } from './entities/reading-goal.entity';
import { Badge } from './entities/badge.entity';
import { UserBadge } from './entities/user-badge.entity';
import { ReadingSession } from '../reading/entities/reading-session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ReadingGoal, Badge, UserBadge, ReadingSession])],
  controllers: [IncentiveController],
  providers: [GoalService, BadgeService],
  exports: [GoalService, BadgeService],
})
export class IncentiveModule {}
