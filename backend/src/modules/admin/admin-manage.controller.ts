import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminArea } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminUserService } from './services/admin-user.service';
import { AdminBookService, AdminModerationService } from './services/admin-book.service';
import { AdminOperationService } from './services/admin-operation.service';
import { AdminFinanceService } from './services/admin-finance.service';
import { AdminSettingsService } from './services/admin-settings.service';
import { AdminAccountService } from './services/admin-account.service';
import { ReportService } from '../community/report.service';
import {
  HandleReportDto,
  ModerationQueryDto,
  ReviewAppealDto,
} from '../community/dto/report.dto';
import {
  PageQueryDto,
  UpdateUserStatusDto,
  ToggleMemberDto,
  UpdateBookStatusDto,
  AuditActionDto,
  BannerDto,
  UpdateBannerDto,
  ColumnDto,
  UpdateColumnDto,
  TopicDto,
  UpdateTopicDto,
  RedeemGenerateDto,
  ChangePasswordDto,
  UpdateAdminProfileDto,
  CreateAdminDto,
  UpdateAdminDto,
  RoleDto,
  OperationLogQueryDto,
} from './dto/manage.dto';

@ApiTags('admin-manage')
@ApiBearerAuth('access-token')
@AdminArea()
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminManageController {
  constructor(
    private readonly dashboard: AdminDashboardService,
    private readonly userSvc: AdminUserService,
    private readonly bookSvc: AdminBookService,
    private readonly moderation: AdminModerationService,
    private readonly operations: AdminOperationService,
    private readonly finance: AdminFinanceService,
    private readonly settingsSvc: AdminSettingsService,
    private readonly accountSvc: AdminAccountService,
    private readonly reportSvc: ReportService,
  ) {}

  // ---------- 数据看板 ----------
  @Get('dashboard/stats')
  @ApiOperation({ summary: '统计概览' })
  stats() {
    return this.dashboard.stats();
  }

  @Get('dashboard/trend')
  @ApiOperation({ summary: '近 N 天趋势' })
  trend(@Query('days') days?: string) {
    return this.dashboard.trend(days ? Number(days) : 30);
  }

  // ---------- 用户管理 ----------
  @Get('users')
  @ApiOperation({ summary: '用户分页列表' })
  users(@Query() query: PageQueryDto) {
    return this.userSvc.list(query);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: '启用/禁用用户' })
  updateUserStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.userSvc.updateStatus(id, dto);
  }

  @Patch('users/:id/member')
  @Throttle(20, 60)
  @ApiOperation({ summary: '手动开通/取消会员' })
  toggleMember(
    @Param('id') id: string,
    @Body() dto: ToggleMemberDto,
  ) {
    return this.userSvc.toggleMember(id, dto.isMember);
  }

  // ---------- 书库管理 ----------
  @Get('books')
  @ApiOperation({ summary: '书籍分页列表' })
  books(@Query() query: PageQueryDto) {
    return this.bookSvc.list(query);
  }

  @Patch('books/:id/status')
  @ApiOperation({ summary: '上架/下架书籍' })
  updateBookStatus(@Param('id') id: string, @Body() dto: UpdateBookStatusDto) {
    return this.bookSvc.updateStatus(id, dto);
  }

  // ---------- 内容审核 ----------
  @Get('moderation/reviews')
  @ApiOperation({ summary: '书评审核队列' })
  reviews(@Query() query: PageQueryDto) {
    return this.moderation.reviews(query);
  }

  @Patch('moderation/reviews/:id')
  @ApiOperation({ summary: '审核书评' })
  auditReview(
    @Param('id') id: string,
    @Body() dto: AuditActionDto,
    @CurrentUser('sub') sub: number,
  ) {
    return this.moderation.auditReview(id, dto, sub);
  }

  @Get('moderation/posts')
  @ApiOperation({ summary: '动态审核队列' })
  posts(@Query() query: PageQueryDto) {
    return this.moderation.posts(query);
  }

  @Patch('moderation/posts/:id')
  @ApiOperation({ summary: '审核动态' })
  auditPost(
    @Param('id') id: string,
    @Body() dto: AuditActionDto,
    @CurrentUser('sub') sub: number,
  ) {
    return this.moderation.auditPost(id, dto, sub);
  }

  @Get('moderation/booklists')
  @ApiOperation({ summary: '书单审核队列' })
  booklists(@Query() query: PageQueryDto) {
    return this.moderation.booklists(query);
  }

  @Patch('moderation/booklists/:id')
  @ApiOperation({ summary: '审核书单' })
  auditBooklist(
    @Param('id') id: string,
    @Body() dto: AuditActionDto,
    @CurrentUser('sub') sub: number,
  ) {
    return this.moderation.auditBooklist(id, dto, sub);
  }

  // ---------- 举报处理 / 申诉复核（P2-12） ----------
  @Get('reports')
  @ApiOperation({ summary: '举报列表' })
  reports(@Query() query: ModerationQueryDto) {
    return this.reportSvc.listReports(query);
  }

  @Patch('reports/:id')
  @ApiOperation({ summary: '处理举报（受理并按累犯分级处罚 / 驳回）' })
  handleReport(
    @Param('id') id: string,
    @Body() dto: HandleReportDto,
    @CurrentUser('sub') sub: number,
  ) {
    return this.reportSvc.handleReport(sub, id, dto);
  }

  @Get('appeals')
  @ApiOperation({ summary: '申诉列表' })
  appeals(@Query() query: ModerationQueryDto) {
    return this.reportSvc.listAppeals(query);
  }

  @Patch('appeals/:id')
  @ApiOperation({ summary: '复核申诉（通过改判撤销处罚 / 驳回维持）' })
  reviewAppeal(
    @Param('id') id: string,
    @Body() dto: ReviewAppealDto,
    @CurrentUser('sub') sub: number,
  ) {
    return this.reportSvc.reviewAppeal(sub, id, dto);
  }

  // ---------- 运营管理 ----------
  @Get('banners')
  @ApiOperation({ summary: 'Banner 列表' })
  banners(@Query() query: PageQueryDto) {
    return this.operations.banners(query);
  }

  @Post('banners')
  @ApiOperation({ summary: '新建 Banner' })
  createBanner(@Body() dto: BannerDto, @CurrentUser('sub') sub: number) {
    return this.operations.createBanner(dto, sub);
  }

  @Patch('banners/:id')
  @ApiOperation({ summary: '更新 Banner' })
  updateBanner(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.operations.updateBanner(id, dto);
  }

  @Delete('banners/:id')
  @ApiOperation({ summary: '删除 Banner' })
  deleteBanner(@Param('id') id: string) {
    return this.operations.deleteBanner(id);
  }

  @Get('columns')
  @ApiOperation({ summary: '专栏/每周好书列表' })
  columns(@Query() query: PageQueryDto & { type?: string }) {
    return this.operations.columns(query);
  }

  @Post('columns')
  @ApiOperation({ summary: '新建专栏' })
  createColumn(@Body() dto: ColumnDto, @CurrentUser('sub') sub: number) {
    return this.operations.createColumn(dto, sub);
  }

  @Patch('columns/:id')
  @ApiOperation({ summary: '更新专栏' })
  updateColumn(@Param('id') id: string, @Body() dto: UpdateColumnDto) {
    return this.operations.updateColumn(id, dto);
  }

  @Delete('columns/:id')
  @ApiOperation({ summary: '删除专栏' })
  deleteColumn(@Param('id') id: string) {
    return this.operations.deleteColumn(id);
  }

  @Get('topics')
  @ApiOperation({ summary: '话题列表' })
  topics(@Query() query: PageQueryDto) {
    return this.operations.topics(query);
  }

  @Post('topics')
  @ApiOperation({ summary: '新建话题' })
  createTopic(@Body() dto: TopicDto) {
    return this.operations.createTopic(dto);
  }

  @Patch('topics/:id')
  @ApiOperation({ summary: '更新话题' })
  updateTopic(@Param('id') id: string, @Body() dto: UpdateTopicDto) {
    return this.operations.updateTopic(id, dto);
  }

  @Delete('topics/:id')
  @ApiOperation({ summary: '删除话题' })
  deleteTopic(@Param('id') id: string) {
    return this.operations.deleteTopic(id);
  }

  // ---------- 会员订单与财务 ----------
  @Get('orders/summary')
  @ApiOperation({ summary: '订单/财务概览' })
  orderSummary() {
    return this.finance.orderSummary();
  }

  @Get('orders')
  @ApiOperation({ summary: '订单分页列表' })
  orders(@Query() query: PageQueryDto) {
    return this.finance.orders(query);
  }

  @Get('redeem-codes')
  @ApiOperation({ summary: '兑换码列表' })
  redeemCodes(@Query() query: PageQueryDto) {
    return this.finance.redeemCodes(query);
  }

  @Post('redeem-codes/generate')
  @Throttle(10, 60)
  @ApiOperation({ summary: '批量生成兑换码' })
  generateRedeem(@Body() dto: RedeemGenerateDto, @CurrentUser('sub') sub: number) {
    return this.finance.generateRedeem(dto, sub);
  }

  // ---------- 系统设置 ----------
  @Get('settings')
  @ApiOperation({ summary: '系统设置概览（资料+套餐）' })
  settings(@CurrentUser('sub') sub: number) {
    return this.settingsSvc.overview(sub);
  }

  @Patch('settings/profile')
  @ApiOperation({ summary: '更新管理员资料' })
  updateProfile(@CurrentUser('sub') sub: number, @Body() dto: UpdateAdminProfileDto) {
    return this.settingsSvc.updateProfile(sub, dto);
  }

  @Post('settings/password')
  @Throttle(5, 60)
  @ApiOperation({ summary: '修改密码' })
  changePassword(@CurrentUser('sub') sub: number, @Body() dto: ChangePasswordDto) {
    return this.settingsSvc.changePassword(sub, dto);
  }

  // ---------- 管理员账号 / 角色 / 操作日志（P2-15） ----------
  @Get('accounts')
  @ApiOperation({ summary: '管理员账号列表' })
  accounts(@Query() query: PageQueryDto) {
    return this.accountSvc.listAdmins(query);
  }

  @Post('accounts')
  @ApiOperation({ summary: '新建管理员账号' })
  createAccount(@Body() dto: CreateAdminDto) {
    return this.accountSvc.createAdmin(dto);
  }

  @Patch('accounts/:id')
  @ApiOperation({ summary: '更新管理员（资料/状态/角色）' })
  updateAccount(@Param('id') id: string, @Body() dto: UpdateAdminDto) {
    return this.accountSvc.updateAdmin(id, dto);
  }

  @Delete('accounts/:id')
  @ApiOperation({ summary: '删除管理员账号' })
  deleteAccount(@Param('id') id: string, @CurrentUser('sub') sub: number) {
    return this.accountSvc.removeAdmin(id, sub);
  }

  @Get('roles')
  @ApiOperation({ summary: '角色列表' })
  roles() {
    return this.accountSvc.listRoles();
  }

  @Post('roles')
  @ApiOperation({ summary: '新建角色' })
  createRole(@Body() dto: RoleDto) {
    return this.accountSvc.createRole(dto);
  }

  @Patch('roles/:id')
  @ApiOperation({ summary: '更新角色与权限' })
  updateRole(@Param('id') id: string, @Body() dto: RoleDto) {
    return this.accountSvc.updateRole(id, dto);
  }

  @Get('operation-logs')
  @ApiOperation({ summary: '管理操作日志查询' })
  operationLogs(@Query() query: OperationLogQueryDto) {
    return this.accountSvc.listOperationLogs(query);
  }
}