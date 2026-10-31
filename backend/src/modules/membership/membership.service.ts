import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { MembershipPlan } from './entities/membership-plan.entity';
import { MembershipOrder } from './entities/order.entity';
import { MemberSubscription } from './entities/member-subscription.entity';
import { PaymentRecord } from './entities/payment-record.entity';
import { RedeemCode } from './entities/redeem-code.entity';
import { Notification } from './entities/notification.entity';
import { UserService } from '../user/user.service';
import { CreateOrderDto } from './dto/create-order.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const TRIAL_DAYS = 7;

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface ActivateOpts {
  orderId?: string;
  channel: string;
  durationDays?: number; // 覆盖套餐默认时长（兑换码）
  baseTime?: Date; // 续费从该时间起续
  autoRenew?: boolean;
}

@Injectable()
export class MembershipService implements OnModuleInit, OnModuleDestroy {
  private renewTimer!: NodeJS.Timeout;
  private remindTimer!: NodeJS.Timeout;

  constructor(
    @InjectRepository(MembershipPlan)
    private readonly planRepo: Repository<MembershipPlan>,
    @InjectRepository(MembershipOrder)
    private readonly orderRepo: Repository<MembershipOrder>,
    @InjectRepository(MemberSubscription)
    private readonly subRepo: Repository<MemberSubscription>,
    @InjectRepository(PaymentRecord)
    private readonly payRepo: Repository<PaymentRecord>,
    @InjectRepository(RedeemCode)
    private readonly redeemRepo: Repository<RedeemCode>,
    @InjectRepository(Notification)
    private readonly noteRepo: Repository<Notification>,
    private readonly userService: UserService,
    private readonly dataSource: DataSource,
  ) {}

  onModuleInit() {
    // 启动即跑一次，之后定时扫描
    this.renewTimer = setInterval(() => {
      this.renewExpiredSubscriptions().catch(() => undefined);
    }, 60_000);
    this.remindTimer = setInterval(() => {
      this.scanExpiryReminder().catch(() => undefined);
    }, 300_000);
    this.renewExpiredSubscriptions().catch(() => undefined);
  }

  onModuleDestroy() {
    clearInterval(this.renewTimer);
    clearInterval(this.remindTimer);
  }

  // ---------- 套餐 ----------

  async listPlans() {
    const plans = await this.planRepo.find({
      where: { status: 'on' },
      order: { sort: 'ASC' },
    });
    return plans.map((p) => this.toPlanView(p));
  }

  // ---------- 下单与支付 ----------

  async createOrder(userId: number, dto: CreateOrderDto) {
    const plan = await this.findOnPlan(String(dto.planId));
    const order = this.orderRepo.create({
      orderNo: this.genOrderNo(),
      userId: String(userId),
      planId: String(plan.id),
      orderType: 'subscription',
      title: plan.name,
      amountFen: plan.priceFen,
      status: 'pending',
      channel: 'wechat',
      remark: dto.autoRenew ? 'auto-renew' : '',
    });
    await this.orderRepo.save(order);
    return {
      orderNo: order.orderNo,
      planId: Number(plan.id),
      title: plan.name,
      amountFen: order.amountFen,
      autoRenew: !!dto.autoRenew,
      status: order.status,
    };
  }

  /** 沙箱模拟支付回调：标记支付成功并即时开通（正式环境替换为微信支付异步通知） */
  async sandboxPay(userId: number, orderNo: string) {
    const order = await this.orderRepo.findOne({
      where: { orderNo, userId: String(userId) },
    });
    if (!order) throw new NotFoundException('订单不存在');

    // 幂等：已支付直接返回当前订阅，避免重复开通
    if (order.status === 'paid') {
      return this.paidResult(userId, order);
    }
    if (order.status !== 'pending') {
      throw new ConflictException('订单状态不可支付');
    }

    // 条件更新：仅当仍为 pending 时才置为 paid，并发下只有一次能成功，避免重复开通
    const paidAt = new Date();
    const upd = await this.orderRepo.update(
      { id: order.id, status: 'pending' },
      { status: 'paid', paidAt },
    );
    if (!upd.affected) {
      // 并发中被其他请求抢先支付，按已支付幂等返回
      const latest = await this.orderRepo.findOne({ where: { id: order.id } });
      if (latest && latest.status === 'paid') {
        return this.paidResult(userId, latest);
      }
      throw new ConflictException('订单状态不可支付');
    }

    order.status = 'paid';
    order.paidAt = paidAt;
    await this.recordPayment(order, 'success', '暂无真实微信回调');

    const plan = await this.planRepo.findOne({ where: { id: Number(order.planId) } });
    const sub = await this.activate(
      userId,
      plan!,
      { orderId: String(order.id), channel: 'wechat', autoRenew: order.remark === 'auto-renew' },
    );
    await this.userService.setMembership(userId, sub.expireTime);

    return this.paidResult(userId, order);
  }

  // ---------- 我的权益 / 试用 / 兑换 ----------

  async myStatus(userId: number) {
    const active = await this.currentSubscription(userId);
    const plans = await this.listPlans();
    const u = await this.userService.getProfile(userId);
    return {
      isMember: !!active,
      memberExpireAt: active ? active.expireTime : null,
      plans,
      subscription: active
        ? {
            status: active.status,
            planName: active.planName,
            startTime: active.startTime,
            expireTime: active.expireTime,
            autoRenew: !!active.autoRenew,
            channel: active.channel,
          }
        : null,
    };
  }

  /** 权益门控检查：供其他模块（时脉导出等）调用 */
  async checkBenefit(userId: number) {
    const active = await this.currentSubscription(userId);
    return {
      enabled: !!active,
      isMember: !!active,
      expireTime: active ? active.expireTime : null,
    };
  }

  /** 新用户试用（7 天，防刷：仅从未开通过的用户可领） */
  async trial(userId: number) {
    const uid = String(userId);
    const plan = await this.planRepo.findOne({ where: { code: 'monthly' } });
    if (!plan) throw new NotFoundException('可用套餐不存在');

    // 事务 + 用户行锁：并发试用请求串行化，避免「先查后写」竞态导致重复领取
    const sub = await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [uid]);
      const anySub = await manager.findOne(MemberSubscription, { where: { userId: uid } });
      if (anySub) throw new ConflictException('你已使用过试用权益');
      // 防刷：下过任何订阅类订单（含未支付）也算用过
      const anyOrder = await manager.findOne(MembershipOrder, {
        where: { userId: uid, orderType: 'subscription' },
      });
      if (anyOrder) throw new ConflictException('你已使用过试用权益');

      return this.activate(
        userId,
        plan,
        { channel: 'trial', durationDays: TRIAL_DAYS },
        manager,
      );
    });
    await this.userService.setMembership(userId, sub.expireTime);
    return { ok: true, expireTime: sub.expireTime, planName: plan.name };
  }

  /** 兑换码核销（一次性、事务防并发重复） */
  async redeem(userId: number, code: string) {
    const normalized = code.trim().toUpperCase();
    const row = await this.redeemRepo.findOne({ where: { code: normalized } });
    if (!row) throw new BadRequestException('兑换码不存在');

    if (row.status === 'disabled' || (row.expiresAt && row.expiresAt.getTime() <= Date.now())) {
      throw new BadRequestException('兑换码已失效');
    }
    if (row.status === 'used') throw new BadRequestException('兑换码已被使用');

    const plan = await this.planRepo.findOne({ where: { id: Number(row.planId) } });
    if (!plan) throw new BadRequestException('兑换码对应的套餐已下架');

    // 事务 + 兑换码行锁：核销与开通原子提交，任一步失败则整体回滚，
    // 避免「码已核销但未开通」导致用户权益丢失
    const sub = await this.dataSource.transaction(async (manager) => {
      const locked = await manager
        .getRepository(RedeemCode)
        .createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.id = :id', { id: row.id })
        .getOne();
      if (!locked) throw new BadRequestException('兑换码不存在');
      if (
        locked.status === 'disabled' ||
        (locked.expiresAt && locked.expiresAt.getTime() <= Date.now())
      ) {
        throw new BadRequestException('兑换码已失效');
      }
      if (locked.status !== 'unused') throw new ConflictException('兑换码已被使用');

      // 原子核销：仅当仍为 unused 时才更新成功，防止并发重复使用
      const upd = await manager.getRepository(RedeemCode).update(
        { id: locked.id, status: 'unused' },
        { status: 'used', usedBy: String(userId), usedAt: new Date() },
      );
      if (!upd.affected) throw new ConflictException('兑换码已被使用');

      // 以当前有效到期时间为基准叠加，避免已是会员时新购时长被旧订阅掩盖而丢失
      const current = await this.currentSubscription(userId, manager);
      return this.activate(
        userId,
        plan,
        {
          channel: 'redeem',
          durationDays: row.durationDays,
          baseTime: current ? current.expireTime : undefined,
        },
        manager,
      );
    });

    await this.userService.setMembership(userId, sub.expireTime);
    return { ok: true, expireTime: sub.expireTime, planName: plan.name };
  }

  /** 用户最近一次有效充值历史（供管理/对账展示订单-流水对应） */
  async myOrders(userId: number, page = 1, pageSize = 10) {
    const take = Math.min(Math.max(1, pageSize), 50);
    const [rows, total] = await this.orderRepo.findAndCount({
      where: { userId: String(userId) },
      order: { createdAt: 'DESC' },
      skip: Math.max(0, page - 1) * take,
      take,
    });
    return {
      list: rows.map((o) => ({
        orderNo: o.orderNo,
        title: o.title,
        amountFen: o.amountFen,
        status: o.status,
        orderType: o.orderType,
        createdAt: o.createdAt,
        paidAt: o.paidAt,
      })),
      total,
      page,
      pageSize: take,
    };
  }

  // ---------- 定时任务 ----------

  /** 自动续费：对已到期且开启自动续费的有效订阅执行模拟扣款并续期 */
  private async renewExpiredSubscriptions() {
    const now = new Date();
    const subs = await this.subRepo
      .createQueryBuilder('s')
      .where('s.status = :st', { st: 'active' })
      .andWhere('s.auto_renew = 1')
      .andWhere('s.expire_time <= :now', { now })
      .getMany();

    for (const sub of subs) {
      const plan = await this.planRepo.findOne({ where: { id: Number(sub.planId) } });
      if (!plan) {
        // 套餐缺失则终止自动续费
        await this.subRepo.update({ id: sub.id }, { autoRenew: 0 });
        continue;
      }
      // 模拟自动扣款：创建已支付订单 + 支付流水，续期
      const order = this.orderRepo.create({
        orderNo: this.genOrderNo(),
        userId: sub.userId,
        planId: String(plan.id),
        orderType: 'subscription',
        title: `${plan.name}·自动续费`,
        amountFen: plan.priceFen,
        status: 'paid',
        channel: 'wechat',
        paidAt: new Date(),
        remark: 'auto-renew',
      });
      await this.orderRepo.save(order);
      await this.recordPayment(order, 'success', '自动续费模拟扣款');
      const renewed = await this.activate(
        Number(sub.userId),
        plan,
        { orderId: String(order.id), channel: 'wechat', baseTime: sub.expireTime, autoRenew: true },
      );
      await this.userService.setMembership(Number(sub.userId), renewed.expireTime);
    }
  }

  /** 到期提醒：按剩余天数 7/3/1 发送站内通知；同步处理到期回收 */
  private async scanExpiryReminder() {
    const now = new Date();
    // 到期回收：未自动续费的有效订阅到期 → 标记过期，保留数据、会员状态按到期计算
    const expired = await this.subRepo
      .createQueryBuilder('s')
      .where('s.status IN (:...st)', { st: ['active', 'trialing'] })
      .andWhere('s.auto_renew = 0')
      .andWhere('s.expire_time <= :now', { now })
      .getMany();
    for (const sub of expired) {
      await this.subRepo.update({ id: sub.id }, { status: 'expired' });
      // 保留 memberExpireAt（过去日期），isMember 由 setMembership 算为 0
      await this.userService.setMembership(Number(sub.userId), sub.expireTime);
    }

    // 到期前 7/3/1 天提醒
    const upcoming = await this.subRepo
      .createQueryBuilder('s')
      .where('s.status IN (:...st)', { st: ['active', 'trialing'] })
      .andWhere('s.expire_time > :now', { now })
      .getMany();
    for (const sub of upcoming) {
      const daysLeft = Math.ceil((sub.expireTime.getTime() - now.getTime()) / DAY_MS);
      if (daysLeft <= 7 && !sub.remind7Sent) {
        await this.sendReminder(sub, 7);
        await this.subRepo.update({ id: sub.id }, { remind7Sent: 1 });
      } else if (daysLeft <= 3 && !sub.remind3Sent) {
        await this.sendReminder(sub, 3);
        await this.subRepo.update({ id: sub.id }, { remind3Sent: 1 });
      } else if (daysLeft <= 1 && !sub.remind1Sent) {
        await this.sendReminder(sub, 1);
        await this.subRepo.update({ id: sub.id }, { remind1Sent: 1 });
      }
    }
  }

  private async sendReminder(sub: MemberSubscription, days: number) {
    const date = localDateStr(sub.expireTime);
    await this.noteRepo.save(
      this.noteRepo.create({
        userId: sub.userId,
        type: 'system',
        title: days === 1 ? '会员今日到期' : `会员将在 ${days} 天后到期`,
        content: `你的会员将于 ${date} 到期${sub.autoRenew ? '，已开启自动续费' : '，请及时续费以免影响权益'}。`,
        senderId: '0',
        targetType: 'membership',
        targetId: String(sub.id),
      }),
    );
  }

  // ---------- 内部辅助 ----------

  private async currentSubscription(userId: number, manager?: EntityManager) {
    const subRepo = manager ? manager.getRepository(MemberSubscription) : this.subRepo;
    const sub = await subRepo
      .createQueryBuilder('s')
      .where('s.user_id = :uid', { uid: String(userId) })
      .andWhere('s.status IN (:...st)', { st: ['active', 'trialing'] })
      .andWhere('s.expire_time > :now', { now: new Date() })
      .orderBy('s.expire_time', 'DESC')
      .getOne();
    if (!sub) return null;
    const plan = await this.planRepo.findOne({ where: { id: Number(sub.planId) } });
    return {
      ...sub,
      planName: plan?.name ?? '会员',
    };
  }

  private async activate(
    userId: number,
    plan: MembershipPlan,
    opts: ActivateOpts,
    manager?: EntityManager,
  ): Promise<MemberSubscription> {
    const uid = String(userId);
    const subRepo = manager ? manager.getRepository(MemberSubscription) : this.subRepo;
    const durationDays = opts.durationDays ?? plan.durationDays;
    const existing = await subRepo
      .createQueryBuilder('s')
      .where('s.user_id = :uid', { uid })
      .andWhere('s.status = :st', { st: 'active' })
      .andWhere('s.auto_renew = 1')
      .orderBy('s.expire_time', 'DESC')
      .getOne();

    const now = opts.baseTime ?? new Date();
    const start =
      existing && existing.expireTime.getTime() > now.getTime()
        ? existing.expireTime
        : opts.baseTime ?? now;
    const expireTime = new Date(start.getTime() + durationDays * DAY_MS);

    if (existing) {
      existing.planId = String(plan.id);
      existing.startTime = now;
      existing.expireTime = expireTime;
      existing.orderId = opts.orderId ?? existing.orderId;
      existing.channel = opts.channel;
      existing.autoRenew = opts.autoRenew === true ? 1 : existing.autoRenew;
      if (existing.status !== 'active') existing.status = 'active';
      return subRepo.save(existing);
    }

    const sub = subRepo.create({
      userId: uid,
      planId: String(plan.id),
      orderId: opts.orderId ?? null,
      startTime: now,
      expireTime,
      status: 'active',
      autoRenew: opts.autoRenew === true ? 1 : 0,
      channel: opts.channel,
    });
    return subRepo.save(sub);
  }

  private async recordPayment(
    order: MembershipOrder,
    status: string,
    remark: string,
  ) {
    await this.payRepo.save(
      this.payRepo.create({
        orderId: String(order.id),
        paymentNo: this.genPaymentNo(),
        transactionId: `SANDBOX${Date.now()}${Math.floor(Math.random() * 1000)}`,
        channel: order.channel,
        amountFen: order.amountFen,
        status,
        rawCallback: { mock: true, remark },
        paidAt: status === 'success' ? new Date() : null,
      }),
    );
  }

  private async paidResult(userId: number, order: MembershipOrder) {
    const active = await this.currentSubscription(userId);
    return {
      paid: true,
      orderNo: order.orderNo,
      amountFen: order.amountFen,
      memberExpireAt: active ? active.expireTime : null,
      isMember: !!active,
    };
  }

  private async findOnPlan(id: string): Promise<MembershipPlan> {
    const plan = await this.planRepo.findOne({ where: { id: Number(id), status: 'on' } });
    if (!plan) throw new NotFoundException('套餐不存在或已下架');
    return plan;
  }

  private toPlanView(p: MembershipPlan) {
    return {
      id: Number(p.id),
      code: p.code,
      name: p.name,
      description: p.description,
      priceFen: p.priceFen,
      originalPriceFen: p.originalPriceFen,
      durationDays: p.durationDays,
      benefits: Array.isArray(p.benefits) ? p.benefits : [],
    };
  }

  private genOrderNo(): string {
    return (
      'M' +
      Date.now().toString(36).toUpperCase() +
      Math.random().toString(36).slice(2, 8).toUpperCase()
    );
  }

  private genPaymentNo(): string {
    return 'P' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1e6);
  }
}