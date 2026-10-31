import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Admin } from '../entities/admin.entity';
import { Role } from '../entities/role.entity';
import { AdminRole } from '../entities/admin-role.entity';
import { OperationLog } from '../entities/operation-log.entity';
import { AuthStateService } from '../../../common/auth-state/auth-state.service';
import {
  CreateAdminDto,
  OperationLogQueryDto,
  PageQueryDto,
  RoleDto,
  UpdateAdminDto,
  pageParams,
  toList,
} from '../dto/manage.dto';

/**
 * 系统设置：管理员账号 / 角色权限 / 操作日志（P2-15）。
 * 权限变更即时生效：改状态、改密、改角色后令牌版本 +1，旧令牌立即失效。
 */
@Injectable()
export class AdminAccountService {
  constructor(
    @InjectRepository(Admin) private readonly adminRepo: Repository<Admin>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(AdminRole)
    private readonly adminRoleRepo: Repository<AdminRole>,
    @InjectRepository(OperationLog)
    private readonly logRepo: Repository<OperationLog>,
    private readonly authState: AuthStateService,
  ) {}

  // ---------- 管理员账号 ----------

  async listAdmins(query: PageQueryDto) {
    const { page, size, skip } = pageParams(query.page, query.size);
    const qb = this.adminRepo.createQueryBuilder('a');
    if (query.keyword) {
      const kw = `%${query.keyword}%`;
      qb.andWhere('(a.username LIKE :kw OR a.name LIKE :kw)', { kw });
    }
    if (query.status) qb.andWhere('a.status = :status', { status: query.status });
    const [rows, total] = await qb
      .orderBy('a.created_at', 'DESC')
      .skip(skip)
      .take(size)
      .getManyAndCount();

    const ids = rows.map((a) => String(a.id));
    const links = ids.length
      ? await this.adminRoleRepo.find({ where: { adminId: In(ids) } })
      : [];
    const roleIds = [...new Set(links.map((l) => String(l.roleId)))];
    const roles = roleIds.length
      ? await this.roleRepo.find({ where: { id: In(roleIds) } })
      : [];
    const roleMap = new Map(roles.map((r) => [String(r.id), r]));
    const roleByAdmin = new Map<string, string[]>();
    for (const l of links) {
      const list = roleByAdmin.get(String(l.adminId)) ?? [];
      const role = roleMap.get(String(l.roleId));
      if (role) list.push(role.code);
      roleByAdmin.set(String(l.adminId), list);
    }

    return toList(
      rows.map((a) => ({
        id: Number(a.id),
        username: a.username,
        name: a.name,
        avatarUrl: a.avatarUrl,
        status: a.status,
        roles: roleByAdmin.get(String(a.id)) ?? [],
        lastLoginAt: a.lastLoginAt,
        createdAt: a.createdAt,
      })),
      total,
      page,
      size,
    );
  }

  async createAdmin(dto: CreateAdminDto) {
    const exists = await this.adminRepo.findOne({ where: { username: dto.username } });
    if (exists) throw new ConflictException('该登录名已存在');
    const admin = this.adminRepo.create({
      username: dto.username,
      passwordHash: bcrypt.hashSync(dto.password, 10),
      name: dto.name || dto.username,
      status: 'active',
    });
    const saved = await this.adminRepo.save(admin);
    await this.syncRoles(String(saved.id), dto.roleCodes ?? []);
    return { id: Number(saved.id), username: saved.username };
  }

  async updateAdmin(id: string, dto: UpdateAdminDto) {
    const admin = await this.adminRepo.findOne({ where: { id: Number(id) } });
    if (!admin) throw new NotFoundException('管理员不存在');

    let bump = false;
    if (dto.name !== undefined) admin.name = dto.name;
    if (dto.password) {
      admin.passwordHash = bcrypt.hashSync(dto.password, 10);
      bump = true;
    }
    if (dto.status && dto.status !== admin.status) {
      admin.status = dto.status;
      if (dto.status !== 'active') bump = true;
    }
    await this.adminRepo.save(admin);

    if (dto.roleCodes) {
      await this.syncRoles(String(admin.id), dto.roleCodes);
      bump = true; // 权限变更即时生效
    }
    if (bump) await this.authState.bumpAdminTokenVersion(Number(admin.id));
    return { id: Number(admin.id), status: admin.status };
  }

  async removeAdmin(id: string, operatorId: number) {
    if (Number(id) === Number(operatorId)) {
      throw new BadRequestException('不能删除当前登录账号');
    }
    const admin = await this.adminRepo.findOne({ where: { id: Number(id) } });
    if (!admin) throw new NotFoundException('管理员不存在');
    if (Number(admin.id) === 1) {
      throw new BadRequestException('内置超级管理员不可删除');
    }
    await this.adminRoleRepo.delete({ adminId: String(admin.id) });
    await this.adminRepo.softRemove(admin);
    await this.authState.bumpAdminTokenVersion(Number(admin.id));
    return { ok: true };
  }

  private async syncRoles(adminId: string, codes: string[]) {
    await this.adminRoleRepo.delete({ adminId });
    if (!codes.length) return;
    const roles = await this.roleRepo.find({ where: { code: In(codes) } });
    if (!roles.length) return;
    await this.adminRoleRepo.insert(
      roles.map((r) => ({ adminId, roleId: String(r.id) })),
    );
  }

  // ---------- 角色 ----------

  async listRoles() {
    const roles = await this.roleRepo.find({ order: { id: 'ASC' } });
    return roles.map((r) => ({
      id: Number(r.id),
      code: r.code,
      name: r.name,
      description: r.description,
      permissions: r.permissions ?? [],
      isBuiltin: !!r.isBuiltin,
      status: r.status,
    }));
  }

  async createRole(dto: RoleDto) {
    if (!dto.code) throw new BadRequestException('角色编码必填');
    const exists = await this.roleRepo.findOne({ where: { code: dto.code } });
    if (exists) throw new ConflictException('角色编码已存在');
    const role = this.roleRepo.create({
      code: dto.code,
      name: dto.name,
      description: dto.description ?? '',
      permissions: dto.permissions ?? [],
      isBuiltin: 0,
      status: dto.status ?? 'active',
    });
    const saved = await this.roleRepo.save(role);
    return { id: Number(saved.id), code: saved.code };
  }

  async updateRole(id: string, dto: RoleDto) {
    const role = await this.roleRepo.findOne({ where: { id: String(id) } });
    if (!role) throw new NotFoundException('角色不存在');
    role.name = dto.name;
    if (dto.description !== undefined) role.description = dto.description;
    if (dto.permissions) role.permissions = dto.permissions;
    if (dto.status) role.status = dto.status;
    await this.roleRepo.save(role);
    // 角色权限变更即时生效：所有绑定该角色的管理员令牌失效，需重新登录
    const links = await this.adminRoleRepo.find({ where: { roleId: String(role.id) } });
    await Promise.all(
      links.map((l) => this.authState.bumpAdminTokenVersion(Number(l.adminId))),
    );
    return { id: Number(role.id), code: role.code };
  }

  // ---------- 操作日志 ----------

  async listOperationLogs(query: OperationLogQueryDto) {
    const { page, size, skip } = pageParams(query.page, query.size);
    const qb = this.logRepo.createQueryBuilder('l');
    if (query.module) qb.andWhere('l.module = :module', { module: query.module });
    if (query.adminId) qb.andWhere('l.admin_id = :aid', { aid: query.adminId });
    if (query.keyword) {
      const kw = `%${query.keyword}%`;
      qb.andWhere('(l.path LIKE :kw OR l.action LIKE :kw OR l.username LIKE :kw)', { kw });
    }
    const [rows, total] = await qb
      .orderBy('l.created_at', 'DESC')
      .skip(skip)
      .take(size)
      .getManyAndCount();
    return toList(
      rows.map((l) => ({
        id: Number(l.id),
        adminId: String(l.adminId),
        username: l.username,
        module: l.module,
        action: l.action,
        method: l.method,
        path: l.path,
        params: l.params,
        ip: l.ip,
        statusCode: l.statusCode,
        durationMs: l.durationMs,
        createdAt: l.createdAt,
      })),
      total,
      page,
      size,
    );
  }

  /** 供操作日志拦截器调用：写入一条管理操作日志 */
  async record(params: {
    adminId: number;
    username: string;
    module: string;
    action: string;
    method: string;
    path: string;
    params?: Record<string, unknown> | null;
    ip: string;
    userAgent: string;
    statusCode: number;
    durationMs: number;
  }) {
    try {
      await this.logRepo.insert({
        adminId: String(params.adminId),
        username: params.username,
        module: params.module,
        action: params.action,
        method: params.method,
        path: params.path.slice(0, 255),
        params: params.params ?? null,
        ip: params.ip ?? '',
        userAgent: (params.userAgent ?? '').slice(0, 255),
        statusCode: params.statusCode,
        durationMs: params.durationMs,
      });
    } catch {
      // 日志失败不影响主流程
    }
  }

  async findAdminUsername(adminId: number): Promise<string> {
    const admin = await this.adminRepo.findOne({
      where: { id: adminId },
      select: ['username'],
    });
    return admin?.username ?? '';
  }

  /** 保留：按关键字模糊匹配（供扩展） */
  async findByKeyword(keyword: string) {
    return this.adminRepo.find({ where: { username: Like(`%${keyword}%`) } });
  }
}
