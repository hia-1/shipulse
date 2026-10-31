import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tag } from './entities/tag.entity';
import { CreateTagDto } from './dto/create-tag.dto';
import { BookTag } from './entities/book-tag.entity';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag)
    private readonly tagRepo: Repository<Tag>,
    @InjectRepository(BookTag)
    private readonly bookTagRepo: Repository<BookTag>,
  ) {}

  /**
   * 标签列表：useCount 实时统计「已上架」图书的引用数。
   * 不走 tags.use_count 冗余列，避免种子数据/状态变更后计数陈旧恒为 0。
   */
  async list() {
    const tags = await this.tagRepo.find({ where: { status: 'on' } });

    const rows = await this.bookTagRepo
      .createQueryBuilder('bt')
      .innerJoin('bt.book', 'b', 'b.deleted_at IS NULL')
      .select('bt.tag_id', 'tagId')
      .addSelect('COUNT(*)', 'cnt')
      .where('b.status = :st', { st: 'on_shelf' })
      .groupBy('bt.tag_id')
      .getRawMany<{ tagId: string; cnt: string }>();
    const countMap = new Map(rows.map((r) => [String(r.tagId), Number(r.cnt)]));

    return tags
      .map((t) => ({
        id: Number(t.id),
        name: t.name,
        useCount: countMap.get(String(t.id)) ?? 0,
      }))
      .sort((a, b) => b.useCount - a.useCount || a.id - b.id);
  }

  async create(dto: CreateTagDto) {
    const existing = await this.tagRepo.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException('标签名已存在');
    const tag = this.tagRepo.create({ name: dto.name, status: dto.status ?? 'on' });
    return this.out(await this.tagRepo.save(tag));
  }

  async update(id: string, dto: CreateTagDto) {
    const tag = await this.tagRepo.findOne({ where: { id } });
    if (!tag) throw new NotFoundException('标签不存在');
    Object.assign(tag, { name: dto.name ?? tag.name, status: dto.status ?? tag.status });
    return this.out(await this.tagRepo.save(tag));
  }

  async remove(id: string) {
    const tag = await this.tagRepo.findOne({ where: { id } });
    if (!tag) throw new NotFoundException('标签不存在');
    await this.tagRepo.softRemove(tag);
    await this.updateUseCount(id);
    return { deleted: true };
  }

  /** 冗余计数：某标签被引用次数（异步） */
  async updateUseCount(tagId: string) {
    const count = await this.bookTagRepo.count({ where: { tagId } });
    void this.tagRepo.update(tagId, { useCount: count });
  }

  private out(t: Tag) {
    return { id: Number(t.id), name: t.name, useCount: t.useCount, status: t.status };
  }
}