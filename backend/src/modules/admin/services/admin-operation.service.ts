import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Banner } from '../../home/entities/banner.entity';
import { ColumnItem } from '../../home/entities/column.entity';
import { Topic } from '../../home/entities/topic.entity';
import { Post } from '../../post/entities/post.entity';
import {
  PageQueryDto,
  pageParams,
  toList,
  BannerDto,
  ColumnDto,
  TopicDto,
} from '../dto/manage.dto';

@Injectable()
export class AdminOperationService {
  constructor(
    @InjectRepository(Banner) private readonly bannerRepo: Repository<Banner>,
    @InjectRepository(ColumnItem)
    private readonly columnRepo: Repository<ColumnItem>,
    @InjectRepository(Topic) private readonly topicRepo: Repository<Topic>,
    @InjectRepository(Post) private readonly postRepo: Repository<Post>,
  ) {}

  async banners(query: PageQueryDto) {
    const { page, size, skip } = pageParams(query.page, query.size);
    const qb = this.bannerRepo.createQueryBuilder('b');
    if (query.status) qb.andWhere('b.status = :status', { status: query.status });
    const [rows, total] = await qb
      .orderBy('b.sort', 'ASC')
      .addOrderBy('b.id', 'DESC')
      .skip(skip)
      .take(size)
      .getManyAndCount();
    return toList(rows, total, page, size);
  }

  async createBanner(dto: BannerDto, by?: number) {
    this.assertSafeBannerLink(dto.linkType, dto.linkValue);
    const banner = this.bannerRepo.create({
      ...dto,
      startTime: dto.startTime ? new Date(dto.startTime) : null,
      endTime: dto.endTime ? new Date(dto.endTime) : null,
      createdBy: by ? String(by) : null,
    });
    const saved = await this.bannerRepo.save(banner);
    return saved;
  }

  async updateBanner(id: string, dto: Partial<BannerDto>) {
    const banner = await this.bannerRepo.findOne({ where: { id } });
    if (!banner) throw new NotFoundException('Banner 不存在');
    this.assertSafeBannerLink(dto.linkType, dto.linkValue);
    Object.assign(banner, {
      ...dto,
      startTime: dto.startTime ? new Date(dto.startTime) : banner.startTime,
      endTime: dto.endTime ? new Date(dto.endTime) : banner.endTime,
    });
    return this.bannerRepo.save(banner);
  }

  async deleteBanner(id: string) {
    const banner = await this.bannerRepo.findOne({ where: { id } });
    if (!banner) throw new NotFoundException('Banner 不存在');
    await this.bannerRepo.softRemove(banner);
    return { ok: true };
  }

  async columns(query: PageQueryDto & { type?: string }) {
    const { page, size, skip } = pageParams(query.page, query.size);
    const qb = this.columnRepo.createQueryBuilder('c');
    if (query.type) qb.andWhere('c.type = :type', { type: query.type });
    if (query.status) qb.andWhere('c.status = :status', { status: query.status });
    if (query.keyword) qb.andWhere('c.title LIKE :kw', { kw: `%${query.keyword}%` });
    const [rows, total] = await qb
      .orderBy('c.created_at', 'DESC')
      .skip(skip)
      .take(size)
      .getManyAndCount();
    return toList(rows, total, page, size);
  }

  async createColumn(dto: ColumnDto, by?: number) {
    const col = this.columnRepo.create({
      ...dto,
      bookId: dto.bookId ? String(dto.bookId) : null,
      publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
      createdBy: by ? String(by) : null,
    });
    return this.columnRepo.save(col);
  }

  async updateColumn(id: string, dto: Partial<ColumnDto>) {
    const col = await this.columnRepo.findOne({ where: { id } });
    if (!col) throw new NotFoundException('专栏不存在');
    Object.assign(col, {
      ...dto,
      bookId: dto.bookId ? String(dto.bookId) : col.bookId,
      publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : col.publishedAt,
    });
    return this.columnRepo.save(col);
  }

  async deleteColumn(id: string) {
    const col = await this.columnRepo.findOne({ where: { id } });
    if (!col) throw new NotFoundException('专栏不存在');
    await this.columnRepo.softRemove(col);
    return { ok: true };
  }

  // ---------- 话题管理 ----------

  async topics(query: PageQueryDto) {
    const { page, size, skip } = pageParams(query.page, query.size);
    const qb = this.topicRepo.createQueryBuilder('t');
    if (query.status) qb.andWhere('t.status = :status', { status: query.status });
    if (query.keyword) qb.andWhere('t.title LIKE :kw', { kw: `%${query.keyword}%` });
    const [rows, total] = await qb
      .orderBy('t.sort', 'ASC')
      .addOrderBy('t.id', 'DESC')
      .skip(skip)
      .take(size)
      .getManyAndCount();
    // post_count 以实际已通过审核的动态数为准（冗余列可能滞后）
    const items = await this.withPostCounts(rows);
    return toList(items, total, page, size);
  }

  async createTopic(dto: TopicDto) {
    const topic = this.topicRepo.create({ ...dto });
    return this.topicRepo.save(topic);
  }

  async updateTopic(id: string, dto: Partial<TopicDto>) {
    const topic = await this.topicRepo.findOne({ where: { id } });
    if (!topic) throw new NotFoundException('话题不存在');
    Object.assign(topic, dto);
    return this.topicRepo.save(topic);
  }

  async deleteTopic(id: string) {
    const topic = await this.topicRepo.findOne({ where: { id } });
    if (!topic) throw new NotFoundException('话题不存在');
    await this.topicRepo.softRemove(topic);
    return { ok: true };
  }

  /** 用实际动态数覆盖冗余 post_count，避免管理端展示与真实数据不一致 */
  private async withPostCounts(rows: Topic[]) {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => String(r.id));
    const counts = (await this.postRepo
      .createQueryBuilder('p')
      .select('p.topic_id', 'topicId')
      .addSelect('COUNT(*)', 'cnt')
      .where('p.topic_id IN (:...ids)', { ids })
      .andWhere('p.audit_status = :st', { st: 'approved' })
      .andWhere('p.deleted_at IS NULL')
      .groupBy('p.topic_id')
      .getRawMany()) as { topicId: string; cnt: string }[];
    const map = new Map(counts.map((c) => [String(c.topicId), Number(c.cnt) || 0]));
    return rows.map((r) => ({ ...r, postCount: map.get(String(r.id)) ?? 0 }));
  }

  /** Banner 跳转链接协议白名单：仅 book/booklist 纯数字 ID，或 http(s) 站内/站外链接 */
  private assertSafeBannerLink(linkType?: string, linkValue?: string) {
    if (!linkType || linkType === 'none') return;
    if (!linkValue) return;
    if ((linkType === 'book' || linkType === 'booklist') && !/^\d{1,20}$/.test(linkValue)) {
      throw new BadRequestException('书籍/书单跳转值必须是纯数字 ID');
    }
    if (linkType === 'web' && !/^https?:\/\//i.test(linkValue)) {
      throw new BadRequestException('站内/外跳转仅允许 http(s) 链接');
    }
    if (/^(javascript|data|vbscript):/i.test(linkValue)) {
      throw new BadRequestException('禁止危险协议跳转');
    }
  }
}