import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type Redis from 'ioredis';
import { Book } from '../library/entities/book.entity';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export type RankType = 'hot' | 'new' | 'rating';

export interface RankEntry {
  bookId: string;
  score: number;
}

/**
 * 书籍榜单（热门 / 新书 / 高分）
 *
 * 榜单排名结果缓存在 Redis ZSET（key `rank:{type}`，score=热度/发布时间/均分），
 * Redis 命中即读缓存；未命中或 Redis 不可用时降级到 MySQL 索引查询直接返回，
 * 并尽力回写缓存（TTL 5 分钟）。书架/阅读等冗余计数异步更新，故榜单热度随 TTL 自然刷新。
 */
@Injectable()
export class RankService implements OnModuleDestroy {
  private readonly logger = new Logger(RankService.name);
  private readonly prefix = 'rank:';
  private readonly ttlSec = 300;
  private readonly warmSize = 60;

  constructor(
    @InjectRepository(Book)
    private readonly bookRepo: Repository<Book>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
  ) {}

  private get r(): Redis | null {
    return this.redis && this.redis.status === 'ready' ? this.redis : null;
  }

  /** 榜单 TopN 书籍 id（保持名次顺序） */
  async getRankIds(type: RankType, limit: number): Promise<RankEntry[]> {
    const n = Math.min(Math.max(1, limit), 30);
    const key = this.prefix + type;

    const r = this.r;
    if (r) {
      try {
        if (!(await r.exists(key))) {
          await this.warm(type, key);
        }
        const raw = await r.zrevrange(key, 0, n - 1, 'WITHSCORES');
        const cached: RankEntry[] = [];
        for (let i = 0; i < raw.length; i += 2) {
          cached.push({ bookId: raw[i], score: Number(raw[i + 1]) });
        }
        if (cached.length > 0) return cached;
      } catch (e) {
        this.logger.warn(`榜单读取降级到 MySQL: ${(e as Error).message}`);
      }
    }
    return this.computeFromDb(type, n);
  }

  /** 用 MySQL 索引查询回填 Redis 缓存 */
  private async warm(type: RankType, key: string) {
    const entries = await this.computeFromDb(type, this.warmSize);
    if (entries.length === 0) return;
    const r = this.redis;
    if (!r) return;
    try {
      const flat: Array<string | number> = [];
      for (const e of entries) {
        flat.push(e.score, e.bookId);
      }
      await r
        .multi()
        .del(key)
        .zadd(key, ...flat)
        .expire(key, this.ttlSec)
        .exec();
    } catch (e) {
      this.logger.warn(`榜单缓存回写失败: ${(e as Error).message}`);
    }
  }

  /** 直接从 MySQL 计算榜单（临时失效/降级路径） */
  private async computeFromDb(type: RankType, n: number): Promise<RankEntry[]> {
    const qb = this.bookRepo
      .createQueryBuilder('b')
      .select(['b.id'])
      .where('b.status = :st', { st: 'on_shelf' })
      .andWhere('b.deleted_at IS NULL')
      .take(n);

    if (type === 'hot') {
      qb.orderBy('(b.shelf_count + b.finished_count * 2 + b.reading_count + b.review_count)', 'DESC');
    } else if (type === 'new') {
      qb.orderBy('b.published_at', 'DESC');
    } else {
      qb.andWhere('b.rating_count > 0').orderBy('b.rating_avg', 'DESC');
    }

    const rows = await qb.getMany();
    return rows.map((row) => ({ bookId: String(row.id), score: 0 }));
  }

  onModuleDestroy() {
    if (this.redis) void this.redis.quit().catch(() => undefined);
  }
}