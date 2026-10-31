import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../modules/user/entities/user.entity';
import { Admin } from '../../modules/admin/entities/admin.entity';
import { AuthStateService } from './auth-state.service';

/** 全局令牌状态模块：供守卫与各业务模块共享（避免每个模块重复声明） */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User, Admin])],
  providers: [AuthStateService],
  exports: [AuthStateService],
})
export class AuthStateModule {}