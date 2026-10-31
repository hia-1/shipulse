import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { Book } from './entities/book.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(Book)
    private readonly bookRepo: Repository<Book>,
  ) {}

  /**
   * 分类树：一级分类含 children（仅 enabled）。
   * bookCount 实时统计「已上架」图书数，父分类 = 自身 + 全部子分类之和。
   * 不走 categories.book_count 冗余列，避免种子数据/状态变更后计数陈旧恒为 0。
   */
  async tree() {
    const all = await this.categoryRepo.find({
      where: { status: 'enabled' },
      order: { sort: 'ASC', id: 'ASC' },
    });

    const rows = await this.bookRepo
      .createQueryBuilder('b')
      .select('b.category_id', 'categoryId')
      .addSelect('COUNT(*)', 'cnt')
      .where('b.status = :st', { st: 'on_shelf' })
      .groupBy('b.category_id')
      .getRawMany<{ categoryId: string | null; cnt: string }>();
    const ownCount = new Map<string, number>();
    for (const r of rows) {
      if (r.categoryId == null) continue;
      ownCount.set(String(r.categoryId), Number(r.cnt));
    }

    const map = new Map<string, Record<string, unknown>>();
    const roots: Record<string, unknown>[] = [];
    for (const c of all) {
      const node = {
        id: Number(c.id),
        parentId: Number(c.parentId),
        name: c.name,
        iconUrl: c.iconUrl,
        sort: c.sort,
        bookCount: ownCount.get(String(c.id)) ?? 0,
        children: [],
      };
      map.set(String(c.id), node);
    }
    for (const c of all) {
      const node = map.get(String(c.id))!;
      if (c.parentId && Number(c.parentId) > 0 && map.has(String(c.parentId))) {
        (map.get(String(c.parentId))!.children as unknown[]).push(node);
      } else {
        roots.push(node);
      }
    }
    for (const node of map.values()) {
      const children = node.children as Record<string, unknown>[];
      if (children.length > 0) {
        node.bookCount =
          Number(node.bookCount) +
          children.reduce((sum, ch) => sum + Number(ch.bookCount), 0);
      }
    }
    return roots;
  }

  async create(dto: CreateCategoryDto) {
    const parentId = dto.parentId && Number(dto.parentId) > 0 ? dto.parentId : '0';
    if (Number(parentId) > 0) {
      const parent = await this.categoryRepo.findOne({ where: { id: parentId } });
      if (!parent) throw new NotFoundException('父分类不存在');
    }
    const existing = await this.categoryRepo.findOne({
      where: { parentId, name: dto.name },
    });
    if (existing) throw new ConflictException('同级分类名已存在');

    const category = this.categoryRepo.create({
      name: dto.name,
      parentId,
      iconUrl: dto.iconUrl || '',
      sort: dto.sort ?? 0,
      status: dto.status ?? 'enabled',
    });
    const saved = await this.categoryRepo.save(category);
    return this.out(saved);
  }

  async update(id: string, dto: CreateCategoryDto) {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) throw new NotFoundException('分类不存在');
    Object.assign(category, {
      name: dto.name ?? category.name,
      parentId: dto.parentId ?? category.parentId,
      iconUrl: dto.iconUrl ?? category.iconUrl,
      sort: dto.sort ?? category.sort,
      status: dto.status ?? category.status,
    });
    return this.out(await this.categoryRepo.save(category));
  }

  async remove(id: string) {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) throw new NotFoundException('分类不存在');
    const children = await this.categoryRepo.count({ where: { parentId: id } });
    if (children > 0) throw new ConflictException('请先删除子分类');
    await this.categoryRepo.softRemove(category);
    await this.updateBookCount(id);
    return { deleted: true };
  }

  /** 冗余计数：某分类下有效图书数（软删除实体自动过滤 deletedAt） */
  async updateBookCount(categoryId: string) {
    const count = await this.bookRepo.count({ where: { categoryId } });
    // fire-and-forget，不阻塞主流程
    void this.categoryRepo.update(categoryId, { bookCount: count });
  }

  private out(c: Category) {
    return {
      id: Number(c.id),
      parentId: Number(c.parentId),
      name: c.name,
      iconUrl: c.iconUrl,
      sort: c.sort,
      bookCount: c.bookCount,
      status: c.status,
    };
  }
}