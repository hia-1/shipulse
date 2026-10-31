import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Book } from './entities/book.entity';
import { BookTag } from './entities/book-tag.entity';
import { Category } from './entities/category.entity';
import { Tag } from './entities/tag.entity';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { QueryBooksDto } from './dto/query-books.dto';
import { CategoriesService } from './categories.service';
import { TagsService } from './tags.service';

@Injectable()
export class BooksService {
  constructor(
    @InjectRepository(Book)
    private readonly bookRepo: Repository<Book>,
    @InjectRepository(BookTag)
    private readonly bookTagRepo: Repository<BookTag>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Tag)
    private readonly tagRepo: Repository<Tag>,
    private readonly categoriesService: CategoriesService,
    private readonly tagsService: TagsService,
  ) {}

  /** 书籍列表（用户侧仅已上架；管理侧 adminOnly=true 可见全部） */
  async list(query: QueryBooksDto, adminOnly = false) {
    const { page, pageSize, keyword, categoryId, tagId, sort } = query;
    const qb = this.bookRepo.createQueryBuilder('b');
    if (!adminOnly) {
      qb.where('b.status = :st', { st: 'on_shelf' });
    }
    if (keyword) {
      qb.andWhere('(b.title LIKE :k OR b.subtitle LIKE :k OR b.author LIKE :k)', {
        k: `%${keyword}%`,
      });
    }
    // 一级分类 = 其全部子分类（含自身）下的书籍
    if (categoryId) {
      const ids = await this.expandCategory(categoryId);
      if (ids.length === 0) return { list: [], total: 0, page, pageSize };
      qb.andWhere('b.category_id IN (:...ids)', { ids });
    }
    if (tagId) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM book_tags bt WHERE bt.book_id = b.id AND bt.tag_id = :tid)',
        { tid: tagId },
      );
    }
    switch (sort) {
      case 'new':
        qb.orderBy('b.published_at', 'DESC');
        break;
      case 'hot':
        qb.orderBy('b.shelf_count', 'DESC');
        break;
      case 'rating':
        qb.orderBy('b.rating_avg', 'DESC');
        break;
      default:
        qb
          .orderBy('b.shelf_count', 'DESC')
          .addOrderBy('b.rating_count', 'DESC')
          .addOrderBy('b.created_at', 'DESC');
    }

    const [rows, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    const list = await this.decorate(rows);
    return { list, total, page, pageSize };
  }

  /** 详情（管理侧含 pending；用户侧仅 on_shelf） */
  async detail(id: string, adminOnly = false) {
    const qb = this.bookRepo.createQueryBuilder('b').where('b.id = :id', { id });
    if (!adminOnly) {
      qb.andWhere('b.status = :st', { st: 'on_shelf' });
    }
    const book = await qb.getOne();
    if (!book) throw new NotFoundException('书籍不存在');
    const [decorated] = await this.decorate([book]);
    return this.attachTags(decorated as unknown as Book);
  }

  /** 按 ISBN 精确查（仅已上架） */
  async findByIsbn(isbn: string) {
    const book = await this.bookRepo.findOne({
      where: { isbn, status: 'on_shelf' },
    });
    if (!book) return null;
    const [decorated] = await this.decorate([book]);
    return this.attachTags(decorated as unknown as Book);
  }

  /** 校验某本书是否已上架（书架/阅读模块用）；返回 book 行，未上架返回 undefined */
  async findBookOnShelf(id: string) {
    return this.bookRepo.findOne({ where: { id, status: 'on_shelf' } });
  }

  /** 按 id 批量取已上架书籍（含分类名；书架/推荐用） */
  async findMany(ids: string[]) {
    const uniq = [...new Set(ids)];
    if (uniq.length === 0) return [];
    const rows = await this.bookRepo
      .createQueryBuilder('b')
      .where('b.status = :st', { st: 'on_shelf' })
      .andWhere('b.id IN (:...ids)', { ids: uniq })
      .getMany();
    return this.decorate(rows);
  }

  async create(dto: CreateBookDto, adminId: number) {
    const isbn = dto.isbn && dto.isbn.trim() ? dto.isbn.trim() : null;
    if (isbn) {
      const dup = await this.bookRepo.findOne({ where: { isbn } });
      if (dup) throw new ConflictException('该 ISBN 已存在，请勿重复入库');
    }
    if (dto.categoryId) {
      const c = await this.categoryRepo.findOne({ where: { id: dto.categoryId } });
      if (!c) throw new NotFoundException('分类不存在');
    }

    const book = this.bookRepo.create({
      isbn,
      title: dto.title,
      subtitle: dto.subtitle ?? '',
      author: dto.author ?? '',
      translator: dto.translator ?? '',
      publisher: dto.publisher ?? '',
      publishedDate: dto.publishedDate ?? '',
      pages: dto.pages ?? 0,
      coverUrl: dto.coverUrl ?? '',
      description: dto.description ?? null,
      categoryId: dto.categoryId ?? null,
      status: (dto.status as Book['status']) ?? 'pending',
      source: isbn ? 'isbn' : 'manual',
      createdBy: String(adminId),
    });

    let saved: Book;
    try {
      saved = await this.bookRepo.save(book);
    } catch (e) {
      // 并发下依赖 DB 唯一索引兜底
      if ((e as { code?: string })?.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('该 ISBN 已存在，请勿重复入库');
      }
      throw e;
    }

    await this.saveTags(saved.id, dto.tagIds ?? []);
    await this.approveCounts(saved.categoryId, dto.tagIds ?? []);

    const row = await this.bookRepo.findOne({ where: { id: saved.id } });
    return this.detail(String(row!.id), true);
  }

  async update(id: string, dto: UpdateBookDto) {
    const book = await this.bookRepo.findOne({ where: { id } });
    if (!book) throw new NotFoundException('书籍不存在');

    if (dto.isbn !== undefined) {
      const isbn = dto.isbn?.trim() || null;
      if (isbn) {
        const dup = await this.bookRepo
          .createQueryBuilder('b')
          .where('b.isbn = :isbn AND b.id != :id', { isbn, id })
          .getOne();
        if (dup) throw new ConflictException('该 ISBN 已被其他书籍使用');
      }
      book.isbn = isbn;
    }
    if (dto.categoryId !== undefined) {
      if (dto.categoryId) {
        const c = await this.categoryRepo.findOne({ where: { id: dto.categoryId } });
        if (!c) throw new NotFoundException('分类不存在');
      }
      book.categoryId = dto.categoryId || null;
    }
    Object.assign(book, {
      title: dto.title ?? book.title,
      subtitle: dto.subtitle ?? book.subtitle,
      author: dto.author ?? book.author,
      translator: dto.translator ?? book.translator,
      publisher: dto.publisher ?? book.publisher,
      publishedDate: dto.publishedDate ?? book.publishedDate,
      pages: dto.pages ?? book.pages,
      coverUrl: dto.coverUrl ?? book.coverUrl,
      description: dto.description !== undefined ? dto.description : book.description,
      status: (dto.status as Book['status']) ?? book.status,
    });
    const saved = await this.bookRepo.save(book);

    if (dto.tagIds !== undefined) {
      await this.bookTagRepo.delete({ bookId: id });
      await this.saveTags(id, dto.tagIds);
    }
    await this.approveCounts(saved.categoryId, dto.tagIds ?? []);
    return this.detail(id, true);
  }

  async publish(id: string) {
    const book = await this.bookRepo.findOne({ where: { id } });
    if (!book) throw new NotFoundException('书籍不存在');
    book.status = 'on_shelf';
    book.publishedAt = book.publishedAt ?? new Date();
    await this.bookRepo.save(book);
    return this.detail(id, true);
  }

  async offShelf(id: string) {
    const book = await this.bookRepo.findOne({ where: { id } });
    if (!book) throw new NotFoundException('书籍不存在');
    book.status = 'off_shelf';
    await this.bookRepo.save(book);
    return this.detail(id, true);
  }

  async remove(id: string) {
    const book = await this.bookRepo.findOne({ where: { id } });
    if (!book) throw new NotFoundException('书籍不存在');
    await this.bookTagRepo.delete({ bookId: id });
    await this.bookRepo.softRemove(book);
    await this.approveCounts(book.categoryId, []);
    return { deleted: true, id: Number(id) };
  }

  /**
   * 冗余计数字段异步维护（评分/书评/书架等由后续模块写入后调用）
   * fire-and-forget：不阻塞调用方主流程
   */
  refreshStats(
    bookId: string,
    stats: Partial<{
      ratingAvg: number;
      ratingCount: number;
      reviewCount: number;
      shelfCount: number;
      wantCount: number;
      readingCount: number;
      finishedCount: number;
    }>,
  ): Promise<void> {
    // 注：repo.update 使用「实体属性名」（camelCase），而非列名
    const patch: Partial<Record<string, unknown>> = {};
    if (stats.ratingCount !== undefined && stats.ratingAvg !== undefined) {
      patch.ratingCount = stats.ratingCount;
      patch.ratingAvg = Math.round(stats.ratingAvg * 100) / 100;
    }
    if (stats.reviewCount !== undefined) patch.reviewCount = stats.reviewCount;
    if (stats.shelfCount !== undefined) patch.shelfCount = stats.shelfCount;
    if (stats.wantCount !== undefined) patch.wantCount = stats.wantCount;
    if (stats.readingCount !== undefined) patch.readingCount = stats.readingCount;
    if (stats.finishedCount !== undefined) patch.finishedCount = stats.finishedCount;
    if (Object.keys(patch).length === 0) return Promise.resolve();
    // fire-and-forget 调用方用 void 忽略；需即时一致性的调用方可 await 本方法
    return this.bookRepo.update(bookId, patch) as unknown as Promise<void>;
  }

  // ---- 内部辅助 ----

  /** 展开分类为自身 + 全部直接子分类 id（两级分类树） */
  private async expandCategory(categoryId: string): Promise<string[]> {
    const cat = await this.categoryRepo.findOne({ where: { id: categoryId } });
    if (!cat) return [];
    const children = await this.categoryRepo.find({
      where: { parentId: String(cat.id) },
    });
    return [String(cat.id), ...children.map((c) => String(c.id))];
  }

  private async saveTags(bookId: string, tagIds: string[]) {
    for (const tagId of tagIds) {
      const tag = await this.tagRepo.findOne({ where: { id: tagId } });
      if (!tag) continue;
      try {
        await this.bookTagRepo.insert({ bookId, tagId });
      } catch (e) {
        if ((e as { code?: string })?.code !== 'ER_DUP_ENTRY') throw e;
      }
    }
  }

  /** 更新分类与标签冗余计数（异步，不阻塞主流程） */
  private async approveCounts(categoryId: string | null, tagIds: string[]) {
    if (categoryId) void this.categoriesService.updateBookCount(categoryId);
    for (const tagId of tagIds) void this.tagsService.updateUseCount(tagId);
  }

  /** 为列表补充分类名 */
  private async decorate(books: Book[]): Promise<Record<string, unknown>[]> {
    if (books.length === 0) return [];
    const ids = [...new Set(books.map((b) => b.categoryId).filter(Boolean))];
    const cats = ids.length
      ? await this.categoryRepo.find({ where: { id: In(ids as string[]) } })
      : [];
    const catMap = new Map(cats.map((c) => [String(c.id), c.name]));
    return books.map((b) => {
      const d = this.out(b);
      d.categoryName = b.categoryId ? catMap.get(String(b.categoryId)) || null : null;
      return d;
    });
  }

  private async attachTags(row: Book & { categoryName?: string | null }): Promise<Record<string, unknown>> {
    const tags = await this.bookTagRepo
      .createQueryBuilder('bt')
      .innerJoin('tags', 't', 't.id = bt.tag_id')
      .select(['t.id AS id', 't.name AS name'])
      .where('bt.book_id = :id', { id: String(row.id) })
      .getRawMany();
    const book: Record<string, unknown> = this.out(row);
    book.categoryName = row.categoryName ?? null;
    book.tags = tags.map((t) => ({ id: Number(t.id), name: t.name }));
    return book;
  }

  private out(b: Book) {
    return {
      id: Number(b.id),
      isbn: b.isbn || null,
      title: b.title,
      subtitle: b.subtitle || '',
      author: b.author || '',
      translator: b.translator || '',
      publisher: b.publisher || '',
      publishedDate: b.publishedDate || '',
      pages: Number(b.pages) || 0,
      coverUrl: b.coverUrl || '',
      description: b.description || null,
      categoryId: b.categoryId ? Number(b.categoryId) : null,
      categoryName: null as string | null,
      ratingAvg: Number(b.ratingAvg) || 0,
      ratingCount: b.ratingCount || 0,
      reviewCount: b.reviewCount || 0,
      shelfCount: b.shelfCount || 0,
      wantCount: b.wantCount || 0,
      readingCount: b.readingCount || 0,
      finishedCount: b.finishedCount || 0,
      status: b.status,
      source: b.source || 'manual',
      publishedAt: b.publishedAt || null,
      createdAt: b.createdAt || null,
    };
  }
}