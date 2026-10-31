import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Admin } from '../entities/admin.entity';
import { MembershipPlan } from '../../membership/entities/membership-plan.entity';
import { ChangePasswordDto, UpdateAdminProfileDto } from '../dto/manage.dto';
import { AuthStateService } from '../../../common/auth-state/auth-state.service';

@Injectable()
export class AdminSettingsService {
  constructor(
    @InjectRepository(Admin) private readonly adminRepo: Repository<Admin>,
    @InjectRepository(MembershipPlan)
    private readonly planRepo: Repository<MembershipPlan>,
    private readonly authState: AuthStateService,
  ) {}

  async overview(adminId: number) {
    const [admin, plans] = await Promise.all([
      this.adminRepo.findOne({ where: { id: adminId } }),
      this.planRepo.find({ where: { status: 'on' } }),
    ]);
    if (!admin) throw new NotFoundException('管理员不存在');
    return {
      profile: {
        id: Number(admin.id),
        username: admin.username,
        name: admin.name,
        avatarUrl: admin.avatarUrl,
        status: admin.status,
        lastLoginAt: admin.lastLoginAt,
      },
      plans: plans.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        priceFen: p.priceFen,
        durationDays: p.durationDays,
        status: p.status,
      })),
    };
  }

  async updateProfile(adminId: number, dto: UpdateAdminProfileDto) {
    const admin = await this.adminRepo.findOne({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('管理员不存在');
    if (dto.name !== undefined) admin.name = dto.name;
    if (dto.avatarUrl !== undefined) admin.avatarUrl = dto.avatarUrl;
    await this.adminRepo.save(admin);
    return {
      id: Number(admin.id),
      username: admin.username,
      name: admin.name,
      avatarUrl: admin.avatarUrl,
    };
  }

  async changePassword(adminId: number, dto: ChangePasswordDto) {
    const admin = await this.adminRepo.findOne({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('管理员不存在');
    if (!bcrypt.compareSync(dto.oldPassword, admin.passwordHash)) {
      throw new BadRequestException('原密码不正确');
    }
    admin.passwordHash = bcrypt.hashSync(dto.newPassword, 10);
    await this.adminRepo.save(admin);
    // 改密后令牌版本 +1：旧令牌立即失效，需重新登录
    await this.authState.bumpAdminTokenVersion(Number(admin.id));
    return { ok: true };
  }
}