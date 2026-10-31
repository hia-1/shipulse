import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { MembershipOrder } from '../../membership/entities/order.entity';
import { RedeemCode } from '../../membership/entities/redeem-code.entity';
import {
  PageQueryDto,
  pageParams,
  toList,
  RedeemGenerateDto,
} from '../dto/manage.dto';

@Injectable()
export class AdminFinanceService {
  constructor(
    @InjectRepository(MembershipOrder)
    private readonly orderRepo: Repository<MembershipOrder>,
    @InjectRepository(RedeemCode)
    private readonly redeemRepo: Repository<RedeemCode>,
  ) {}

  async orderSummary() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [all, paid, pending, refunded, todayPaid] = await Promise.all([
      this.orderRepo.count(),
      this.orderRepo.count({ where: { status: 'paid' } }),
      this.orderRepo.count({ where: { status: 'pending' } }),
      this.orderRepo.count({ where: { status: 'refunded' } }),
      this.orderRepo.count({ where: { status: 'paid', paidAt: MoreThanOrEqual(startOfDay) } }),
    ]);
    const raws = await this.orderRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.amount_fen),0)', 'total')
      .addSelect('COALESCE(SUM(CASE WHEN o.paid_at >= :from THEN o.amount_fen ELSE 0 END),0)', 'today')
      .where('o.status = :st', { st: 'paid' })
      .setParameter('from', startOfDay)
      .getRawOne<{ total: string; today: string }>();

    return {
      ordersTotal: all,
      paidCount: paid,
      pendingCount: pending,
      refundedCount: refunded,
      todayPaidCount: todayPaid,
      revenueFen: Number(raws?.total ?? 0),
      revenueTodayFen: Number(raws?.today ?? 0),
    };
  }

  async orders(query: PageQueryDto) {
    const { page, size, skip } = pageParams(query.page, query.size);
    const qb = this.orderRepo.createQueryBuilder('o');
    if (query.status) qb.andWhere('o.status = :status', { status: query.status });
    if (query.keyword) {
      const kw = `%${query.keyword}%`;
      qb.andWhere('(o.order_no LIKE :kw OR o.user_id LIKE :kw)', { kw });
    }
    const [rows, total] = await qb
      .orderBy('o.created_at', 'DESC')
      .skip(skip)
      .take(size)
      .getManyAndCount();
    return toList(rows, total, page, size);
  }

  async redeemCodes(query: PageQueryDto & { batchNo?: string }) {
    const { page, size, skip } = pageParams(query.page, query.size);
    const qb = this.redeemRepo.createQueryBuilder('rc');
    if (query.status) qb.andWhere('rc.status = :status', { status: query.status });
    if (query.batchNo) qb.andWhere('rc.batch_no = :batchNo', { batchNo: query.batchNo });
    const [rows, total] = await qb
      .orderBy('rc.created_at', 'DESC')
      .skip(skip)
      .take(size)
      .getManyAndCount();
    return toList(rows, total, page, size);
  }

  async generateRedeem(dto: RedeemGenerateDto, by?: number) {
    const count = Math.min(Math.max(dto.count || 10, 1), 500);
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const batchNo = dto.batchNo || `B${Date.now()}`;
    const rand = (len: number) =>
      Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const codes: RedeemCode[] = [];
    while (codes.length < count) {
      const code = `SL${rand(16)}`;
      try {
        const row = this.redeemRepo.create({
          code,
          batchNo,
          planId: String(dto.planId),
          durationDays: dto.durationDays,
          status: 'unused',
          createdBy: by ? String(by) : null,
        });
        const saved = await this.redeemRepo.save(row);
        codes.push(saved);
      } catch {
        // 唯一键冲突则跳过重试
      }
    }
    return { batchNo, count: codes.length, codes: codes.map((c) => c.code) };
  }
}