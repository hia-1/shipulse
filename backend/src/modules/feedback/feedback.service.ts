import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feedback } from './entities/feedback.entity';
import { SubmitFeedbackDto } from './dto/feedback.dto';

/** 意见反馈（P2-06）：提交入库 + 我的反馈记录 */
@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(Feedback)
    private readonly feedbackRepo: Repository<Feedback>,
  ) {}

  async submit(userId: number, dto: SubmitFeedbackDto) {
    const content = (dto.content ?? '').trim();
    if (content.length < 5) {
      throw new BadRequestException('反馈内容至少 5 个字');
    }
    const images =
      Array.isArray(dto.images) && dto.images.length > 0 ? dto.images : null;
    const saved = await this.feedbackRepo.save(
      this.feedbackRepo.create({
        userId: String(userId),
        type: dto.type ?? 'suggestion',
        content,
        contact: (dto.contact ?? '').trim(),
        images,
        status: 'pending',
      }),
    );
    return {
      id: Number(saved.id),
      status: saved.status,
      createdAt: saved.createdAt,
    };
  }

  async mine(userId: number, page = 1, size = 10) {
    const [rows, total] = await this.feedbackRepo.findAndCount({
      where: { userId: String(userId) },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * size,
      take: size,
    });
    return {
      list: rows.map((r) => ({
        id: Number(r.id),
        type: r.type,
        content: r.content,
        contact: r.contact,
        status: r.status,
        reply: r.reply,
        repliedAt: r.repliedAt,
        createdAt: r.createdAt,
      })),
      total,
      page,
      size,
    };
  }
}
