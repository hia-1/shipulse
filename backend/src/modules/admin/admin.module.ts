import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminManageController } from './admin-manage.controller';
import { Admin } from './entities/admin.entity';
import { Role } from './entities/role.entity';
import { AdminRole } from './entities/admin-role.entity';
import { OperationLog } from './entities/operation-log.entity';
import { User } from '../user/entities/user.entity';
import { Book } from '../library/entities/book.entity';
import { Review } from '../community/entities/review.entity';
import { Post } from '../post/entities/post.entity';
import { Booklist } from '../booklist/entities/booklist.entity';
import { Banner } from '../home/entities/banner.entity';
import { ColumnItem } from '../home/entities/column.entity';
import { Topic } from '../home/entities/topic.entity';
import { MembershipOrder } from '../membership/entities/order.entity';
import { RedeemCode } from '../membership/entities/redeem-code.entity';
import { MembershipPlan } from '../membership/entities/membership-plan.entity';
import { AuthModule } from '../auth/auth.module';
import { CommunityModule } from '../community/community.module';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminUserService } from './services/admin-user.service';
import { AdminBookService, AdminModerationService } from './services/admin-book.service';
import { AdminOperationService } from './services/admin-operation.service';
import { AdminFinanceService } from './services/admin-finance.service';
import { AdminSettingsService } from './services/admin-settings.service';
import { AdminAccountService } from './services/admin-account.service';
import { OperationLogInterceptor } from './interceptors/operation-log.interceptor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Admin,
      Role,
      AdminRole,
      OperationLog,
      User,
      Book,
      Review,
      Post,
      Booklist,
      Banner,
      ColumnItem,
      Topic,
      MembershipOrder,
      RedeemCode,
      MembershipPlan,
    ]),
    AuthModule,
    CommunityModule,
  ],
  controllers: [AdminController, AdminManageController],
  providers: [
    AdminService,
    AdminGuard,
    AdminDashboardService,
    AdminUserService,
    AdminBookService,
    AdminModerationService,
    AdminOperationService,
    AdminFinanceService,
    AdminSettingsService,
    AdminAccountService,
    { provide: APP_INTERCEPTOR, useClass: OperationLogInterceptor },
  ],
  exports: [AdminService],
})
export class AdminModule {}
