import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from '@nestjs/common';
import type Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export interface HotItem {
  keyword: string;
  count: number;
}

/**
 * 热搜词（Redis ZSET 维护；Redis 不可用时优雅降级到进程内存，保底可用）
 * 访问热同步到热榜（后续 P1-09 首页热榜可复用同一集合）。
 */
@Injectable()
export class SearchService implements OnModuleDestroy {
  private readonly logger = new Logger(SearchService.name);
  private readonly hotKey = 'search:hot';
  private readonly maxHot = 50;

  /** 进程内存降级兜底：keyword -> count */
  private fallback = new Map<string, number>();

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | null) {}

  private get r(): Redis | null {
    return this.redis && this.redis.status === 'ready' ? this.redis : null;
  }

  /** 记录一次搜索（异步、不阻塞，热词 ZSET 自增） */
  async record(keyword: string) {
    const k = (keyword || '').trim().slice(0, 40);
    if (!k || k.length < 2) return;
    try {
      const r = this.r;
      if (r) {
        await r.zincrby(this.hotKey, 1, k);
        // 裁剪超出上限的冷词，防止无限增长
        await r.zremrangebyrank(this.hotKey, 0, -(this.maxHot + 1));
        return;
      }
    } catch (e) {
      this.logger.warn(`记录热词降级到内存: ${(e as Error).message}`);
    }
    this.fallback.set(k, (this.fallback.get(k) || 0) + 1);
  }

  /** 热门搜索词（倒序，带搜索次数） */
  async hot(limit = 10): Promise<HotItem[]> {
    const n = Math.min(Math.max(1, limit), 20);
    try {
      const r = this.r;
      if (r) {
        const raw = await r.zrevrange(this.hotKey, 0, n - 1, 'WITHSCORES');
        const list: HotItem[] = [];
        for (let i = 0; i < raw.length; i += 2) {
          list.push({ keyword: raw[i], count: Number(raw[i + 1]) });
        }
        return list;
      }
    } catch (e) {
      this.logger.warn(`热搜降级到内存: ${(e as Error).message}`);
    }
    return [...this.fallback.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([keyword, count]) => ({ keyword, count }));
  }

  onModuleDestroy() {
    if (this.redis) void this.redis.quit().catch(() => undefined);
  }
}