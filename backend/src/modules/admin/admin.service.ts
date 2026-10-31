import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Admin } from './entities/admin.entity';
import { AdminRole } from './entities/admin-role.entity';
import { Role } from './entities/role.entity';
import { AdminLoginDto } from './dto/admin-login.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,
    @InjectRepository(AdminRole)
    private readonly adminRoleRepo: Repository<AdminRole>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  ping() {
    return { module: 'admin', status: 'skeleton' };
  }

  async login(dto: AdminLoginDto) {
    const admin = await this.adminRepo.findOne({
      where: { username: dto.username },
    });
    if (!admin || admin.status !== 'active') {
      // 统一反馈，避免通过错误文案枚举有效管理员账号
      throw new UnauthorizedException('用户名或密码错误');
    }

    const valid = bcrypt.compareSync(dto.password, admin.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    admin.lastLoginAt = new Date();
    await this.adminRepo.save(admin);

    const payload = { sub: Number(admin.id), type: 'admin' as const, tv: Number(admin.tokenVersion ?? 0) };
    const secret = this.configService.get<string>('jwt.secret');
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload, tokenType: 'access' },
        {
          secret,
          expiresIn: this.configService.get<string>('jwt.accessExpires'),
        },
      ),
      this.jwtService.signAsync(
        { ...payload, tokenType: 'refresh' },
        {
          secret,
          expiresIn: this.configService.get<string>('jwt.refreshExpires'),
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      admin: {
        id: Number(admin.id),
        username: admin.username,
        name: admin.name,
        avatarUrl: admin.avatarUrl,
        roles: await this.rolesOf(Number(admin.id)),
      },
    };
  }

  async getProfile(id: number) {
    const admin = await this.adminRepo.findOne({ where: { id } });
    if (!admin) {
      throw new NotFoundException('管理员不存在');
    }
    return {
      id: Number(admin.id),
      username: admin.username,
      name: admin.name,
      avatarUrl: admin.avatarUrl,
      status: admin.status,
      lastLoginAt: admin.lastLoginAt,
      roles: await this.rolesOf(Number(admin.id)),
    };
  }

  /** 取管理员角色编码列表（权限变更后重新登录即生效） */
  private async rolesOf(adminId: number): Promise<string[]> {
    const links = await this.adminRoleRepo.find({ where: { adminId: String(adminId) } });
    if (!links.length) return [];
    const roles = await this.roleRepo.find({
      where: { id: In(links.map((l) => String(l.roleId))) },
    });
    return roles.filter((r) => r.status === 'active').map((r) => r.code);
  }
}
