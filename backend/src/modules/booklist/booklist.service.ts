import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Booklist } from './entities/booklist.entity';
import { BooklistItem } from './entities/booklist-item.entity';
import { Like } from '../community/entities/like.entity';
import { User } from '../user/entities/user.entity';
import { BooksService } from '../library/books.service';
import { ModerationService, MachineDecision } from '../community/moderation.service';
import { AuthStateService } from '../../common/auth-state/auth-state.service';
import { sanitizeText } from '../../common/utils/sanitize';
import { CreateBooklistDto } from './dto/create-booklist.dto';
import { UpdateBooklistDto, AddBookItemDto } from './dto/add-book-item.dto';

/** 机审决策 → 审核状态（decision 用 reject，存储用 rejected） */
function toAuditStatus(decision: MachineDecision): string {
  if (decision === 'approve') return 'approved';
  if (decision === 'reject') return 'rejected';
  return 'pending';
}

/** 广场预设主题标签：按标题/简介模糊匹配 */
export const BOOKLIST_TAGS = [
  '经典',
  '科幻',
  '悬疑',
  '文学',
  '历史',
  '推理',
  '自我提升',
  '治愈',
  '豆瓣高分',
  '入门',
] as const;

type SquareSort = 'hot' | 'newest';

@Injectable()
export class BooklistService {
  constructor(
    @InjectRepository(Booklist)
    private readonly listRepo: Repository<Booklist>,
    @InjectRepository(BooklistItem)
    private readonly itemRepo: Repository<BooklistItem>,
    @InjectRepository(Like)
    private readonly likeRepo: Repository<Like>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly booksService: BooksService,
    private readonly moderationService: ModerationService,
    private readonly authState: AuthStateService,
  ) {}

  // ---------- 创建 / 编辑 / 删除 ----------

  async create(userId: number, dto: CreateBooklistDto) {
    await this.authState.assertCanWrite(userId);
    // 与书评/动态一致：走机审，通过即发布，可疑转人工，违规驳回
    const title = sanitizeText(dto.title);
    const description = sanitizeText(dto.description ?? '');
    const check = this.moderationService.check(`${title} ${description}`.trim());
    const auditStatus = toAuditStatus(check.decision);
    const list = await this.listRepo.save(
      this.listRepo.create({
        userId: String(userId),
        title,
        description,
        coverUrl: (dto.coverUrl ?? '').trim(),
        auditStatus,
        auditReason: check.reason || '',
        machineScore: check.score,
        publishedAt: auditStatus === 'approved' ? new Date() : null,
      }),
    );
    if (dto.bookIds?.length) {
      await this.addBooks(list, dto.bookIds);
    }
    await this.moderationService.log({
      targetType: 'booklist',
      targetId: String(list.id),
      action: 'machine',
      reason: check.reason,
      operatorType: 'machine',
      detail: { score: check.score, decision: check.decision },
    });
    return this.detail(userId, Number(list.id));
  }

  async update(userId: number, id: number, dto: UpdateBooklistDto) {
    const list = await this.owned(userId, id);
    if (dto.title !== undefined) list.title = sanitizeText(dto.title);
    if (dto.description !== undefined) list.description = sanitizeText(dto.description);
    if (dto.coverUrl !== undefined) list.coverUrl = dto.coverUrl.trim();
    return this.listRepo.save(list);
  }

  async remove(userId: number, id: number) {
    await this.owned(userId, id);
    await this.listRepo.softDelete(id);
    return { deleted: true, id };
  }

  // ---------- 加书 / 移除 ----------

  async addBook(userId: number, id: number, dto: AddBookItemDto) {
    if (!dto.bookId) throw new BadRequestException('bookId 必填');
    const list = await this.owned(userId, id);
    const bookId = Number(dto.bookId);
    // orIgnore + 唯一键(uk_list_book)去重：并发重复加书仅首次成功，避免重复行与计数漂移
    const ins = await this.itemRepo
      .createQueryBuilder()
      .insert()
      .into(BooklistItem)
      .values({
        booklistId: String(list.id),
        bookId: String(bookId),
        note: (dto.note ?? '').trim(),
        sort: list.itemCount,
      })
      .orIgnore()
      .execute();
    // 以 affectedRows 判断是否真正插入：orIgnore 命中重复时 identifiers 仍非空，不可据此判定
    if (Number((ins.raw as { affectedRows?: number })?.affectedRows ?? 0) <= 0) {
      throw new ConflictException('该书已在书单中');
    }
    await this.listRepo.increment({ id: list.id }, 'itemCount', 1);
    return this.detail(userId, Number(list.id));
  }

  async removeBook(userId: number, id: number, bookId: number) {
    const list = await this.owned(userId, id);
    const res = await this.itemRepo.delete({
      booklistId: String(list.id),
      bookId: String(bookId),
    });
    if (!res.affected) throw new NotFoundException('书单中不存在该书');
    // 条件原子减一，避免并发下计数漂移与无符号列下溢
    await this.listRepo
      .createQueryBuilder()
      .update(Booklist)
      .set({ itemCount: () => 'item_count - 1' })
      .where('id = :id AND item_count > 0', { id: list.id })
      .execute();
    return this.detail(userId, Number(list.id));
  }

  // ---------- 收藏 / 取消收藏 ----------

  async collect(userId: number, id: number) {
    const list = await this.findVisible(id);
    if (list.userId === String(userId)) {
      throw new ForbiddenException('不能收藏自己的书单');
    }
    const inserted = await this.insertCollect(String(userId), String(list.id));
    if (inserted) {
      await this.listRepo.increment({ id: list.id }, 'collectCount', 1);
    }
    // 返回数据库真实计数，避免并发/重复收藏下返回陈旧或错误值
    return this.collectState(list);
  }

  async uncollect(userId: number, id: number) {
    const list = await this.findVisible(id);
    const res = await this.likeRepo.delete({
      userId: String(userId),
      targetType: 'booklist',
      targetId: String(list.id),
      interactionType: 'collect',
    });
    if (res.affected) {
      // 条件原子减一，避免并发下计数漂移与无符号列下溢
      await this.listRepo
        .createQueryBuilder()
        .update(Booklist)
        .set({ collectCount: () => 'collect_count - 1' })
        .where('id = :id AND collect_count > 0', { id: list.id })
        .execute();
    }
    const state = await this.collectState(list);
    return { ...state, collected: false };
  }

  // ---------- 广场 / 详情 / 我的 / 按书收录 ----------

  async square(query: {
    tag?: string;
    q?: string;
    sort?: SquareSort;
    page?: number;
    pageSize?: number;
    userId?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const take = Math.min(Math.max(1, query.pageSize ?? 12), 50);
    const qb = this.listRepo
      .createQueryBuilder('bl')
      .where('bl.audit_status = :st', { st: 'approved' })
      .andWhere('bl.published_at IS NOT NULL');

    if (query.tag) {
      qb.andWhere('(bl.title LIKE :kw OR bl.description LIKE :kw)', {
        kw: `%${query.tag}%`,
      });
    }
    if (query.q) {
      qb.andWhere('(bl.title LIKE :kw2 OR bl.description LIKE :kw2)', {
        kw2: `%${query.q}%`,
      });
    }
    if (query.sort === 'newest') {
      qb.orderBy('bl.published_at', 'DESC');
    } else {
      qb.orderBy('bl.collect_count', 'DESC');
    }
    qb.addOrderBy('bl.id', 'DESC');

    const [rows, total] = await qb
      .skip((page - 1) * take)
      .take(take)
      .getManyAndCount();

    const userIds = [...new Set(rows.map((r) => r.userId))];
    const creators = await this.nickMap(userIds);

    const collectedIds = new Set(
      query.userId
        ? (
            await this.likeRepo.find({
              where: {
                userId: String(query.userId),
                targetType: 'booklist',
                interactionType: 'collect',
                targetId: In(rows.map((r) => String(r.id))),
              },
            })
          ).map((l) => l.targetId)
        : [],
    );

    return {
      list: rows.map((r) => this.toCard(r, creators, collectedIds)),
      total,
      page,
      pageSize: take,
      tags: BOOKLIST_TAGS,
    };
  }

  async detail(userId: number | null, id: number) {
    const list = await this.listRepo.findOne({ where: { id: String(id) } });
    if (!list) throw new NotFoundException('书单不存在');
    const isMine = userId != null && list.userId === String(userId);
    // 非创建者仅能查看已审核发布的公开书单，避免未发布/被驳回内容被遍历
    if (!isMine && (list.auditStatus !== 'approved' || !list.publishedAt)) {
      throw new NotFoundException('书单不存在或未发布');
    }
    const items = await this.itemRepo.find({
      where: { booklistId: String(list.id) },
      order: { sort: 'ASC' },
    });
    const books = await this.booksService.findMany(items.map((i) => String(i.bookId)));
    const bookById = new Map(books.map((b) => [String(b.id), b]));
    const creator = await this.nickMap([list.userId]);

    let collected = false;
    let likeCount = list.collectCount;
    if (userId != null) {
      collected = !!(await this.likeRepo.findOne({
        where: {
          userId: String(userId),
          targetType: 'booklist',
          targetId: String(list.id),
          interactionType: 'collect',
        },
      }));
      likeCount = list.collectCount;
    }

    return {
      id: Number(list.id),
      title: list.title,
      description: list.description,
      coverUrl: list.coverUrl,
      itemCount: list.itemCount,
      collectCount: likeCount,
      isOfficial: list.isOfficial,
      isMine,
      auditStatus: list.auditStatus,
      auditReason: list.auditReason,
      creator: creator.get(list.userId) ?? '书友',
      publishedAt: list.publishedAt,
      books: items
        .map((it) => {
          const b = bookById.get(String(it.bookId));
          if (!b) return null;
          return {
            bookId: Number(b.id),
            title: (b as unknown as { title?: string }).title ?? '',
            author: (b as unknown as { author?: string }).author ?? '',
            coverUrl: (b as unknown as { coverUrl?: string }).coverUrl ?? '',
            note: it.note,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x != null),
      collected,
    };
  }

  async myList(userId: number) {
    const created = await this.listRepo.find({
      where: { userId: String(userId) },
      order: { createdAt: 'DESC' },
    });
    const collectedRows = await this.likeRepo.find({
      where: {
        userId: String(userId),
        targetType: 'booklist',
        interactionType: 'collect',
      },
      order: { createdAt: 'DESC' },
    });
    const collected = collectedRows.length
      ? await this.listRepo.find({
          where: { id: In(collectedRows.map((l) => l.targetId)) },
        })
      : [];
    const creators = await this.nickMap([...created, ...collected].map((r) => r.userId));
    const collectedIds = new Set(collectedRows.map((l) => l.targetId));
    const mapTo = (rows: Booklist[]) =>
      rows.map((r) => this.toCard(r, creators, collectedIds));
    return { created: mapTo(created), collected: mapTo(collected) };
  }

  /** 收录了某书的书单（供书籍详情页模块） */
  async byBook(bookId: number, userId: number | null) {
    const items = await this.itemRepo.find({ where: { bookId: String(bookId) } });
    const ids = [...new Set(items.map((i) => i.booklistId))];
    if (!ids.length) return { list: [] };
    const lists = await this.listRepo
      .createQueryBuilder('bl')
      .where('bl.id IN (:...ids)', { ids })
      .andWhere('bl.audit_status = :st', { st: 'approved' })
      .andWhere('bl.published_at IS NOT NULL')
      .orderBy('bl.collectCount', 'DESC')
      .getMany();
    const creators = await this.nickMap(lists.map((r) => r.userId));
    const collectedIds = new Set(
      userId
        ? (
            await this.likeRepo.find({
              where: {
                userId: String(userId),
                targetType: 'booklist',
                interactionType: 'collect',
                targetId: In(lists.map((r) => String(r.id))),
              },
            })
          ).map((l) => l.targetId)
        : [],
    );
    return {
      bookId,
      list: lists.map((r) => this.toCard(r, creators, collectedIds)),
    };
  }

  /** 广场标签元信息 */
  tagsMeta() {
    return { tags: BOOKLIST_TAGS };
  }

  // ---------- 内部辅助 ----------

  private async addBooks(list: Booklist, bookIds: number[]) {
    const rows = bookIds.map((bookId, i) =>
      this.itemRepo.create({
        booklistId: String(list.id),
        bookId: String(bookId),
        sort: i,
        note: '',
      }),
    );
    await this.itemRepo.save(rows);
    await this.listRepo.update({ id: list.id }, { itemCount: rows.length });
  }

  private async owned(userId: number, id: number): Promise<Booklist> {
    const list = await this.listRepo.findOne({ where: { id: String(id) } });
    if (!list) throw new NotFoundException('书单不存在');
    if (list.userId !== String(userId)) {
      throw new ForbiddenException('只能操作自己的书单');
    }
    return list;
  }

  private async findVisible(id: number, needMine = false): Promise<Booklist> {
    const list = await this.listRepo.findOne({ where: { id: String(id) } });
    if (!list) throw new NotFoundException('书单不存在');
    if (!needMine && (list.auditStatus !== 'approved' || !list.publishedAt)) {
      throw new NotFoundException('书单不存在或未发布');
    }
    return list;
  }

  private async insertCollect(userId: string, targetId: string) {
    const ins = await this.likeRepo
      .createQueryBuilder()
      .insert()
      .into(Like)
      .values({
        userId,
        targetType: 'booklist',
        targetId,
        interactionType: 'collect',
      })
      .orIgnore()
      .execute();
    // 以 affectedRows 判断是否真正插入：orIgnore 命中重复时 identifiers 仍非空
    return Number((ins.raw as { affectedRows?: number })?.affectedRows ?? 0) > 0;
  }

  private async nickMap(userIds: string[]): Promise<Map<string, string>> {
    const uniq = [...new Set(userIds)].filter(Boolean);
    if (!uniq.length) return new Map();
    const users = await this.userRepo.find({ where: { id: In(uniq) } });
    return new Map(users.map((u) => [String(u.id), u.nickname]));
  }

  private toCard(
    list: Booklist,
    creators: Map<string, string>,
    collectedIds: Set<string>,
  ) {
    return {
      id: Number(list.id),
      title: list.title,
      description: list.description,
      coverUrl: list.coverUrl,
      itemCount: list.itemCount,
      collectCount: list.collectCount,
      isOfficial: list.isOfficial,
      creator: creators.get(String(list.userId)) ?? '书友',
      publishedAt: list.publishedAt,
      collected: collectedIds.has(String(list.id)),
    };
  }

  /** 收藏结果：读取数据库真实计数，避免返回陈旧值 */
  private async collectState(list: Booklist) {
    const fresh = await this.listRepo.findOne({
      where: { id: String(list.id) },
      select: ['collectCount'],
    });
    return {
      collected: true,
      collectCount: fresh?.collectCount ?? list.collectCount,
      id: Number(list.id),
    };
  }
}