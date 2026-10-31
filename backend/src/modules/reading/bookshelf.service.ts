import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bookshelf, type ShelfStatus } from './entities/bookshelf.entity';
import { BooksService } from '../library/books.service';

export interface ShelfEntry {
  id: number;
  bookId: number;
  status: ShelfStatus;
  currentPage: number;
  progress: number;
  lastReadAt: Date | null;
  updatedAt: Date;
}

/**
 * 个人书架：想读 / 在读 / 已读三态（互斥切换），记录冗余计数。
 * 三态操作共用本服务（P1-04 详情页三态组件 + P1-05 书架页）。
 */
@Injectable()
export class BookshelfService {
  constructor(
    @InjectRepository(Bookshelf)
    private readonly repo: Repository<Bookshelf>,
    private readonly booksService: BooksService,
  ) {}

  /** 我的某本书的当前状态（未加书架返回 null） */
  async getStatus(userId: number, bookId: string): Promise<{ status: ShelfStatus | null }> {
    const row = await this.repo.findOne({
      where: { userId: String(userId), bookId },
    });
    return { status: row ? row.status : null };
  }

  /** 查找用户某本书的书架记录（内部调用，关联阅读场次用） */
  async findByUserBook(userId: number, bookId: string): Promise<Bookshelf | null> {
    return this.repo.findOne({ where: { userId: String(userId), bookId } });
  }

  /** 三态切换（upsert）：切到新状态即时生效，并异步更新书籍计数 */
  async setStatus(userId: number, bookId: string, status: ShelfStatus) {
    const book = await this.booksService.findBookOnShelf(bookId);
    if (!book) throw new NotFoundException('书籍不存在或未上架');

    const uid = String(userId);
    // 含软删除一并查，便于恢复旧记录，避免 user_book 唯一键冲突
    const row = await this.repo
      .createQueryBuilder('s')
      .where('s.user_id = :uid AND s.book_id = :bookId', { uid, bookId })
      .withDeleted()
      .getOne();

    if (row) {
      row.status = status;
      row.deletedAt = null;
      await this.repo.save(row);
    } else {
      await this.repo.insert({ userId: uid, bookId, status });
    }

    await this.refreshCounts(bookId);
    return this.getStatus(userId, bookId);
  }

  /** 移出书架（软删除） */
  async remove(userId: number, bookId: string) {
    const uid = String(userId);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await this.repo.softDelete({ userId: uid, bookId });
    await this.refreshCounts(bookId);
    return { ok: true };
  }

  /** 我的书架列表（可按三态过滤，按最近阅读/更新时间倒序） */
  async list(
    userId: number,
    page = 1,
    pageSize = 20,
    status?: ShelfStatus,
  ) {
    const take = Math.min(Math.max(1, pageSize), 50);
    const qb = this.repo
      .createQueryBuilder('s')
      .where('s.user_id = :uid', { uid: String(userId) })
      .orderBy('s.updated_at', 'DESC')
      .skip((page - 1) * take)
      .take(take);
    if (status) {
      qb.andWhere('s.status = :status', { status });
    }
    const [rows, total] = await qb.getManyAndCount();
    const entries: ShelfEntry[] = rows.map((r) => ({
      id: Number(r.id),
      bookId: Number(r.bookId),
      status: r.status,
      currentPage: r.currentPage,
      progress: r.progress,
      lastReadAt: r.lastReadAt,
      updatedAt: r.updatedAt,
    }));
    // 补充书目信息
    const books = await this.booksService.findMany(rows.map((r) => r.bookId));
    const bookMap = new Map(books.map((b) => [String(b.id), b]));
    const list = entries.map((e) => ({
      ...e,
      book: bookMap.get(String(e.bookId)) ?? {
        id: e.bookId,
        title: '书籍已下架',
        coverUrl: '',
        author: '',
        pages: 0,
        ratingAvg: 0,
        categoryName: null,
      },
    }));
    return { list, total, page, pageSize };
  }

  /** 统计某时间区间内标记为「已读」的书籍数（年度盘点用） */
  async countFinishedInRange(userId: number, start: Date, end: Date): Promise<number> {
    return this.repo
      .createQueryBuilder('s')
      .where('s.user_id = :uid', { uid: String(userId) })
      .andWhere('s.status = :st', { st: 'read' })
      .andWhere('s.updated_at >= :start AND s.updated_at < :end', { start, end })
      .getCount();
  }

  /** 更新阅读进度（页码 + 百分比 + 最近阅读时间） */
  async updateProgress(
    userId: number,
    bookId: string,
    currentPage: number,
    progress: number,
  ) {
    const uid = String(userId);
    const row = await this.repo.findOne({ where: { userId: uid, bookId } });
    if (!row) throw new NotFoundException('该书籍不在书架中');
    row.currentPage = Math.max(0, Math.floor(currentPage));
    row.progress = Math.max(0, Math.min(100, Math.floor(progress)));
    row.lastReadAt = new Date();
    await this.repo.save(row);
    return {
      bookId: Number(row.bookId),
      currentPage: row.currentPage,
      progress: row.progress,
      lastReadAt: row.lastReadAt,
    };
  }

  /** 重算某本书的书架计数并异步写回冗余字段 */
  private async refreshCounts(bookId: string) {
    const qb = this.repo
      .createQueryBuilder('s')
      .select('s.status', 'status')
      .addSelect('COUNT(*)', 'cnt')
      .where('s.book_id = :bookId', { bookId })
      .andWhere('s.deleted_at IS NULL')
      .groupBy('s.status');
    const rows = (await qb.getRawMany()) as { status: string; cnt: string }[];
    let shelfCount = 0;
    let want = 0;
    let reading = 0;
    let finished = 0;
    for (const r of rows) {
      const n = Number(r.cnt);
      shelfCount += n;
      if (r.status === 'want') want = n;
      else if (r.status === 'reading') reading = n;
      else if (r.status === 'read') finished = n;
    }
    // 等待冗余字段写入，保证调用方随后读取到的最新计数一致
    await this.booksService.refreshStats(bookId, {
      wantCount: want,
      readingCount: reading,
      finishedCount: finished,
      shelfCount,
    });
  }
}