import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Event, EventStatus } from './entities/event.entity';
import { EventSignup } from './entities/event-signup.entity';
import { User } from '../user/entities/user.entity';
import {
  CreateEventDto,
  EventQueryDto,
  UpdateEventDto,
} from './dto/event.dto';

/** 允许的状态流转（状态机）：draft→ongoing→finished；任意态可→canceled */
const TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  draft: ['ongoing', 'canceled'],
  ongoing: ['finished', 'canceled'],
  finished: [],
  canceled: [],
};

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    @InjectRepository(EventSignup)
    private readonly signupRepo: Repository<EventSignup>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  // ==================== 用户端 ====================

  /** 活动列表（仅非草稿） */
  async listPublic(query: EventQueryDto, userId?: number) {
    const { page, size, skip } = this.pageParams(query.page, query.size);
    const qb = this.eventRepo
      .createQueryBuilder('e')
      .where('e.status IN (:...sts)', { sts: ['ongoing', 'finished'] });
    if (query.type) qb.andWhere('e.type = :type', { type: query.type });
    if (query.keyword) qb.andWhere('e.title LIKE :kw', { kw: `%${query.keyword}%` });
    const [rows, total] = await qb
      .orderBy('e.status', 'ASC')
      .addOrderBy('e.start_time', 'DESC')
      .skip(skip)
      .take(size)
      .getManyAndCount();

    const signed = userId
      ? await this.signupRepo.find({
          where: { userId: String(userId), eventId: In(rows.map((r) => String(r.id))) },
        })
      : [];
    const signedSet = new Set(signed.filter((s) => s.status === 'signed').map((s) => String(s.eventId)));

    return {
      items: rows.map((e) => this.toView(e, signedSet.has(String(e.id)))),
      total,
      page,
      size,
    };
  }

  /** 活动详情 */
  async detail(id: string, userId?: number) {
    const event = await this.eventRepo.findOne({ where: { id: String(id) } });
    if (!event || event.status === 'draft') {
      throw new NotFoundException('活动不存在');
    }
    let isSigned = false;
    if (userId) {
      const s = await this.signupRepo.findOne({
        where: { eventId: String(event.id), userId: String(userId) },
      });
      isSigned = s?.status === 'signed';
    }
    return { ...this.toView(event, isSigned), description: event.description ?? '' };
  }

  /** 报名 */
  async signup(userId: number, eventId: string) {
    const event = await this.eventRepo.findOne({ where: { id: String(eventId) } });
    if (!event) throw new NotFoundException('活动不存在');
    if (event.status !== 'ongoing') throw new BadRequestException('活动当前不可报名');

    const now = Date.now();
    if (event.signupStart && now < event.signupStart.getTime()) {
      throw new BadRequestException('报名尚未开始');
    }
    if (event.signupEnd && now > event.signupEnd.getTime()) {
      throw new BadRequestException('报名已结束');
    }

    if (event.memberOnly) {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user?.isMember) throw new ForbiddenException('该活动为会员专属，请先开通会员');
    }

    const uid = String(userId);
    const existing = await this.signupRepo.findOne({
      where: { eventId: String(event.id), userId: uid },
    });
    if (existing?.status === 'signed') {
      throw new ConflictException('你已报名该活动');
    }

    if (existing) {
      // 曾取消报名：重新报名（占用名额前先原子校验余量）
      await this.occupySeat(String(event.id), event.capacity);
      existing.status = 'signed';
      existing.signupTime = new Date();
      await this.signupRepo.save(existing);
    } else {
      await this.occupySeat(String(event.id), event.capacity);
      const ins = await this.signupRepo
        .createQueryBuilder()
        .insert()
        .into(EventSignup)
        .values({ eventId: String(event.id), userId: uid, status: 'signed' })
        .orIgnore()
        .execute();
      if (Number((ins.raw as { affectedRows?: number })?.affectedRows ?? 0) === 0) {
        // 并发重复报名：回退名额
        await this.eventRepo.decrement({ id: String(event.id) }, 'signupCount', 1);
        throw new ConflictException('你已报名该活动');
      }
    }

    const fresh = await this.eventRepo.findOne({ where: { id: String(event.id) } });
    return { eventId: Number(event.id), isSigned: true, signupCount: fresh?.signupCount ?? 0 };
  }

  /** 取消报名 */
  async cancelSignup(userId: number, eventId: string) {
    const signup = await this.signupRepo.findOne({
      where: { eventId: String(eventId), userId: String(userId) },
    });
    if (!signup || signup.status !== 'signed') {
      throw new BadRequestException('你尚未报名该活动');
    }
    signup.status = 'canceled';
    await this.signupRepo.save(signup);
    // 仅在计数大于 0 时减一，避免并发下计数漂移为负
    await this.eventRepo
      .createQueryBuilder()
      .update(Event)
      .set({ signupCount: () => 'GREATEST(signup_count - 1, 0)' })
      .where('id = :id', { id: String(eventId) })
      .execute();
    const fresh = await this.eventRepo.findOne({ where: { id: String(eventId) } });
    return { eventId: Number(eventId), isSigned: false, signupCount: fresh?.signupCount ?? 0 };
  }

  /** 我的报名 */
  async mySignups(userId: number, page = 1, size = 10) {
    const take = Math.min(Math.max(1, size), 50);
    const [rows, total] = await this.signupRepo.findAndCount({
      where: { userId: String(userId), status: 'signed' },
      order: { createdAt: 'DESC' },
      skip: Math.max(0, page - 1) * take,
      take,
    });
    const events = rows.length
      ? await this.eventRepo.find({ where: { id: In(rows.map((r) => String(r.eventId))) } })
      : [];
    const map = new Map(events.map((e) => [String(e.id), e]));
    return {
      items: rows
        .map((r) => map.get(String(r.eventId)))
        .filter((e): e is Event => !!e)
        .map((e) => this.toView(e, true)),
      total,
      page,
      size: take,
    };
  }

  // ==================== 管理端 ====================

  async listAdmin(query: EventQueryDto) {
    const { page, size, skip } = this.pageParams(query.page, query.size);
    const qb = this.eventRepo.createQueryBuilder('e');
    if (query.status) qb.andWhere('e.status = :status', { status: query.status });
    if (query.type) qb.andWhere('e.type = :type', { type: query.type });
    if (query.keyword) qb.andWhere('e.title LIKE :kw', { kw: `%${query.keyword}%` });
    const [rows, total] = await qb
      .orderBy('e.created_at', 'DESC')
      .skip(skip)
      .take(size)
      .getManyAndCount();
    return { items: rows.map((e) => this.toView(e)), total, page, size };
  }

  async create(dto: CreateEventDto, adminId?: number) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('活动时间格式不正确');
    }
    if (end <= start) throw new BadRequestException('结束时间必须晚于开始时间');
    const event = this.eventRepo.create({
      title: dto.title,
      type: dto.type as Event['type'],
      coverUrl: dto.coverUrl ?? '',
      description: dto.description ?? '',
      startTime: start,
      endTime: end,
      signupStart: dto.signupStart ? new Date(dto.signupStart) : null,
      signupEnd: dto.signupEnd ? new Date(dto.signupEnd) : null,
      capacity: dto.capacity ?? 0,
      memberOnly: dto.memberOnly ? 1 : 0,
      status: (dto.status as EventStatus) ?? 'draft',
      createdBy: adminId ? String(adminId) : null,
    });
    const saved = await this.eventRepo.save(event);
    return this.toView(saved);
  }

  async update(id: string, dto: UpdateEventDto) {
    const event = await this.eventRepo.findOne({ where: { id: String(id) } });
    if (!event) throw new NotFoundException('活动不存在');
    if (dto.title !== undefined) event.title = dto.title;
    if (dto.type !== undefined) event.type = dto.type as Event['type'];
    if (dto.coverUrl !== undefined) event.coverUrl = dto.coverUrl;
    if (dto.description !== undefined) event.description = dto.description;
    if (dto.startTime) event.startTime = new Date(dto.startTime);
    if (dto.endTime) event.endTime = new Date(dto.endTime);
    if (dto.signupStart !== undefined) {
      event.signupStart = dto.signupStart ? new Date(dto.signupStart) : null;
    }
    if (dto.signupEnd !== undefined) {
      event.signupEnd = dto.signupEnd ? new Date(dto.signupEnd) : null;
    }
    if (dto.capacity !== undefined) event.capacity = dto.capacity;
    if (dto.memberOnly !== undefined) event.memberOnly = dto.memberOnly ? 1 : 0;
    if (event.endTime <= event.startTime) {
      throw new BadRequestException('结束时间必须晚于开始时间');
    }
    const saved = await this.eventRepo.save(event);
    return this.toView(saved);
  }

  async updateStatus(id: string, status: string) {
    const event = await this.eventRepo.findOne({ where: { id: String(id) } });
    if (!event) throw new NotFoundException('活动不存在');
    const target = status as EventStatus;
    if (target === event.status) return this.toView(event);
    if (!TRANSITIONS[event.status].includes(target)) {
      throw new BadRequestException(`不允许从「${event.status}」流转到「${target}」`);
    }
    event.status = target;
    const saved = await this.eventRepo.save(event);
    return this.toView(saved);
  }

  async remove(id: string) {
    const event = await this.eventRepo.findOne({ where: { id: String(id) } });
    if (!event) throw new NotFoundException('活动不存在');
    await this.eventRepo.softRemove(event);
    return { ok: true };
  }

  // ==================== 内部辅助 ====================

  /** 原子占位：capacity=0 不限；否则仅在余量>0 时 +1 */
  private async occupySeat(eventId: string, capacity: number) {
    const qb = this.eventRepo
      .createQueryBuilder()
      .update(Event)
      .set({ signupCount: () => 'signup_count + 1' })
      .where('id = :id', { id: eventId });
    if (capacity > 0) {
      qb.andWhere('signup_count < :cap', { cap: capacity });
    }
    const res = await qb.execute();
    if (!res.affected) throw new ConflictException('报名名额已满');
  }

  private toView(e: Event, isSigned = false) {
    return {
      id: Number(e.id),
      title: e.title,
      type: e.type,
      coverUrl: e.coverUrl,
      description: e.description ?? '',
      startTime: e.startTime,
      endTime: e.endTime,
      signupStart: e.signupStart,
      signupEnd: e.signupEnd,
      capacity: e.capacity,
      signupCount: e.signupCount,
      memberOnly: !!e.memberOnly,
      status: e.status,
      isSigned,
      createdAt: e.createdAt,
    };
  }

  private pageParams(page = 1, size = 15) {
    const p = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const s = Number.isFinite(size) && size > 0 ? Math.min(Math.floor(size), 200) : 15;
    return { page: p, size: s, skip: (p - 1) * s };
  }
}
