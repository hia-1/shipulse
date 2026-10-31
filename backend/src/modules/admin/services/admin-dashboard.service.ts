import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, FindOptionsWhere } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Book } from '../../library/entities/book.entity';
import { Review } from '../../community/entities/review.entity';
import { Post } from '../../post/entities/post.entity';
import { Booklist } from '../../booklist/entities/booklist.entity';
import { MembershipOrder } from '../../membership/entities/order.entity';

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Post) private readonly postRepo: Repository<Post>,
    @InjectRepository(Booklist)
    private readonly booklistRepo: Repository<Booklist>,
    @InjectRepository(MembershipOrder)
    private readonly orderRepo: Repository<MembershipOrder>,
  ) {}

  async stats() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    const [
      totalUsers,
      usersToday,
      activeUsers7d,
      totalBooks,
      booksPublished,
      reviewsTotal,
      reviewsPending,
      postsPending,
      booklistsPending,
      ordersTotal,
      ordersPaid,
      ordersPending,
      membersActive,
    ] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.count({ where: { createdAt: MoreThanOrEqual(startOfDay) } }),
      this.userRepo.count({ where: { lastLoginAt: MoreThanOrEqual(sevenDaysAgo) } }),
      this.bookRepo.count(),
      // 书籍状态域为 pending/on_shelf/off_shelf，无 published；已上架即 on_shelf
      this.bookRepo.count({ where: { status: 'on_shelf' } }),
      this.reviewRepo.count({ where: { auditStatus: 'approved' } }),
      this.reviewRepo.count({ where: { auditStatus: 'pending' } }),
      this.postRepo.count({ where: { auditStatus: 'pending' } }),
      this.booklistRepo.count({ where: { auditStatus: 'pending' } }),
      this.orderRepo.count(),
      this.orderRepo.count({ where: { status: 'paid' } }),
      this.orderRepo.count({ where: { status: 'pending' } }),
      this.userRepo.count({
        where: [
          { isMember: 1, memberExpireAt: MoreThanOrEqual(new Date()) },
          { isMember: 1, memberExpireAt: null },
        ] as FindOptionsWhere<User>[],
      }),
    ]);

    const revenue = await this.orderRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.amount_fen), 0)', 'total')
      .where('o.status = :st', { st: 'paid' })
      .getRawOne<{ total: string }>();

    const revenueToday = await this.orderRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.amount_fen), 0)', 'total')
      .where('o.status = :st', { st: 'paid' })
      .andWhere('o.paid_at >= :from', { from: startOfDay })
      .getRawOne<{ total: string }>();

    return {
      users: {
        total: totalUsers,
        today: usersToday,
        active7d: activeUsers7d,
      },
      books: { total: totalBooks, published: booksPublished },
      reviews: { total: reviewsTotal, pending: reviewsPending },
      moderation: {
        reviewsPending,
        postsPending,
        booklistsPending,
      },
      finance: {
        ordersTotal,
        ordersPaid,
        pendingCount: ordersPending,
        revenueFen: Number(revenue?.total ?? 0),
        revenueTodayFen: Number(revenueToday?.total ?? 0),
      },
      members: { active: membersActive },
    };
  }

  /** 近 N 天趋势：注册/下单/营收/书评 */
  async trend(days = 30) {
    const n = Number.isFinite(days) && days > 0 ? Math.min(Math.floor(days), 120) : 30;
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - n + 1);

    const fmt = "DATE_FORMAT({field}, '%Y-%m-%d')";

    const [userRows, orderRows, reviewRows] = await Promise.all([
      this.userRepo
        .createQueryBuilder('u')
        .select(`${fmt.replace('{field}', 'u.created_at')} AS d, COUNT(*) AS c`)
        .where('u.created_at >= :from', { from })
        .groupBy('d')
        .getRawMany<{ d: string; c: string }>(),
      this.orderRepo
        .createQueryBuilder('o')
        .select(
          `${fmt.replace('{field}', 'o.paid_at')} AS d, COUNT(*) AS c, COALESCE(SUM(o.amount_fen),0) AS r`,
        )
        .where('o.status = :st', { st: 'paid' })
        .andWhere('o.paid_at >= :from', { from })
        .groupBy('d')
        .getRawMany<{ d: string; c: string; r: string }>(),
      this.reviewRepo
        .createQueryBuilder('r')
        .select(`${fmt.replace('{field}', 'r.created_at')} AS d, COUNT(*) AS c`)
        .where('r.audit_status = :st', { st: 'approved' })
        .andWhere('r.created_at >= :from', { from })
        .groupBy('d')
        .getRawMany<{ d: string; c: string }>(),
    ]);

    const uMap = new Map(userRows.map((x) => [x.d, Number(x.c)]));
    const oMap = new Map(orderRows.map((x) => [x.d, Number(x.c)]));
    const rMap = new Map(orderRows.map((x) => [x.d, Number(x.r)])); // 营收
    const vMap = new Map(reviewRows.map((x) => [x.d, Number(x.c)]));

    const out: {
      date: string;
      users: number;
      orders: number;
      revenueFen: number;
      reviews: number;
    }[] = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
      ).padStart(2, '0')}`;
      out.push({
        date: key,
        users: uMap.get(key) ?? 0,
        orders: oMap.get(key) ?? 0,
        revenueFen: rMap.get(key) ?? 0,
        reviews: vMap.get(key) ?? 0,
      });
    }
    return out;
  }
}