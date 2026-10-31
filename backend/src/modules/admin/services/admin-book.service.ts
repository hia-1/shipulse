import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from '../../library/entities/book.entity';
import { Review } from '../../community/entities/review.entity';
import { Post } from '../../post/entities/post.entity';
import { Booklist } from '../../booklist/entities/booklist.entity';
import { ModerationService } from '../../community/moderation.service';
import {
  PageQueryDto,
  pageParams,
  toList,
  UpdateBookStatusDto,
  AuditActionDto,
} from '../dto/manage.dto';

@Injectable()
export class AdminBookService {
  constructor(
    @InjectRepository(Book) private readonly bookRepo: Repository<Book>,
  ) {}

  async list(query: PageQueryDto) {
    const { page, size, skip } = pageParams(query.page, query.size);
    const qb = this.bookRepo.createQueryBuilder('b');
    if (query.keyword) {
      const kw = `%${query.keyword}%`;
      qb.andWhere('(b.title LIKE :kw OR b.author LIKE :kw OR b.isbn LIKE :kw)', { kw });
    }
    if (query.status) qb.andWhere('b.status = :status', { status: query.status });
    const [rows, total] = await qb
      .orderBy('b.created_at', 'DESC')
      .skip(skip)
      .take(size)
      .getManyAndCount();
    return toList(
      rows.map((b) => ({
        id: String(b.id),
        title: b.title,
        author: b.author,
        isbn: b.isbn,
        coverUrl: b.coverUrl,
        publisher: b.publisher,
        ratingAvg: b.ratingAvg,
        ratingCount: b.ratingCount,
        shelfCount: b.shelfCount,
        status: b.status,
        source: b.source,
        publishedAt: b.publishedAt,
        createdAt: b.createdAt,
      })),
      total,
      page,
      size,
    );
  }

  async updateStatus(id: string, dto: UpdateBookStatusDto) {
    const book = await this.bookRepo.findOne({ where: { id } });
    if (!book) throw new NotFoundException('书籍不存在');
    book.status = dto.status as Book['status'];
    if (dto.status === 'on_shelf' && !book.publishedAt) {
      book.publishedAt = new Date();
    }
    await this.bookRepo.save(book);
    return { id: String(book.id), status: book.status };
  }
}

@Injectable()
export class AdminModerationService {
  constructor(
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Post) private readonly postRepo: Repository<Post>,
    @InjectRepository(Booklist)
    private readonly booklistRepo: Repository<Booklist>,
    private readonly moderation: ModerationService,
  ) {}

  private stringify(e: {
    id: string | number;
    userId?: string;
    createdAt?: Date;
  }) {
    return { id: String(e.id), userId: e.userId ? String(e.userId) : '', createdAt: e.createdAt };
  }

  async reviews(query: PageQueryDto & { type?: string }) {
    const { page, size, skip } = pageParams(query.page, query.size);
    const qb = this.reviewRepo.createQueryBuilder('r');
    if (query.status) qb.andWhere('r.audit_status = :status', { status: query.status });
    const [rows, total] = await qb
      .orderBy('r.created_at', 'DESC')
      .skip(skip)
      .take(size)
      .getManyAndCount();
    return toList(
      rows.map((r) => ({
        ...this.stringify(r),
        bookId: String(r.bookId),
        rating: r.rating,
        title: r.title,
        content: (r.content ?? '').slice(0, 120),
        likeCount: r.likeCount,
        auditStatus: r.auditStatus,
        machineScore: r.machineScore,
        isFeatured: r.isFeatured,
        publishedAt: r.publishedAt,
      })),
      total,
      page,
      size,
    );
  }

  async auditReview(id: string, dto: AuditActionDto, operatorId = 0) {
    const row = await this.reviewRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('书评不存在');
    row.auditStatus = dto.action === 'approve' ? 'approved' : 'rejected';
    row.auditReason = dto.reason || row.auditReason;
    row.publishedAt = dto.action === 'approve' ? row.publishedAt ?? new Date() : null;
    await this.reviewRepo.save(row);
    await this.moderation.log({
      targetType: 'review',
      targetId: String(row.id),
      action: dto.action === 'approve' ? 'approve' : 'reject',
      reason: dto.reason || (dto.action === 'approve' ? '人工复审通过' : '人工复审驳回'),
      operatorType: 'admin',
      operatorId,
    });
    return { id: String(row.id), auditStatus: row.auditStatus };
  }

  async posts(query: PageQueryDto) {
    const { page, size, skip } = pageParams(query.page, query.size);
    const qb = this.postRepo.createQueryBuilder('p');
    if (query.status) qb.andWhere('p.audit_status = :status', { status: query.status });
    const [rows, total] = await qb
      .orderBy('p.created_at', 'DESC')
      .skip(skip)
      .take(size)
      .getManyAndCount();
    return toList(
      rows.map((p) => ({
        ...this.stringify(p),
        type: p.type,
        content: p.content.slice(0, 120),
        readMinutes: p.readMinutes,
        auditStatus: p.auditStatus,
        machineScore: p.machineScore,
        publishedAt: p.publishedAt,
      })),
      total,
      page,
      size,
    );
  }

  async auditPost(id: string, dto: AuditActionDto, operatorId = 0) {
    const row = await this.postRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('动态不存在');
    row.auditStatus = dto.action === 'approve' ? 'approved' : 'rejected';
    row.auditReason = dto.reason || row.auditReason;
    row.publishedAt = dto.action === 'approve' ? row.publishedAt ?? new Date() : null;
    await this.postRepo.save(row);
    await this.moderation.log({
      targetType: 'post',
      targetId: String(row.id),
      action: dto.action === 'approve' ? 'approve' : 'reject',
      reason: dto.reason || (dto.action === 'approve' ? '人工复审通过' : '人工复审驳回'),
      operatorType: 'admin',
      operatorId,
    });
    return { id: String(row.id), auditStatus: row.auditStatus };
  }

  async booklists(query: PageQueryDto) {
    const { page, size, skip } = pageParams(query.page, query.size);
    const qb = this.booklistRepo.createQueryBuilder('bl');
    if (query.status) qb.andWhere('bl.audit_status = :status', { status: query.status });
    const [rows, total] = await qb
      .orderBy('bl.created_at', 'DESC')
      .skip(skip)
      .take(size)
      .getManyAndCount();
    return toList(
      rows.map((b) => ({
        id: String(b.id),
        userId: String(b.userId),
        title: b.title,
        description: b.description.slice(0, 100),
        itemCount: b.itemCount,
        collectCount: b.collectCount,
        auditStatus: b.auditStatus,
        isOfficial: b.isOfficial,
        publishedAt: b.publishedAt,
        createdAt: b.createdAt,
      })),
      total,
      page,
      size,
    );
  }

  async auditBooklist(id: string, dto: AuditActionDto, operatorId = 0) {
    const row = await this.booklistRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('书单不存在');
    row.auditStatus = dto.action === 'approve' ? 'approved' : 'rejected';
    row.publishedAt = dto.action === 'approve' ? row.publishedAt ?? new Date() : null;
    await this.booklistRepo.save(row);
    await this.moderation.log({
      targetType: 'booklist',
      targetId: String(row.id),
      action: dto.action === 'approve' ? 'approve' : 'reject',
      reason: dto.reason || (dto.action === 'approve' ? '人工复审通过' : '人工复审驳回'),
      operatorType: 'admin',
      operatorId,
    });
    return { id: String(row.id), auditStatus: row.auditStatus };
  }
}