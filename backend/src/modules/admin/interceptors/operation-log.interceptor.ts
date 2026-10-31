import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AdminAccountService } from '../services/admin-account.service';
import type { JwtPayload } from '../../../common/decorators/current-user.decorator';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/** 敏感字段脱敏，避免口令等写入日志 */
const SENSITIVE = ['password', 'newPassword', 'oldPassword', 'token', 'refreshToken'];

/**
 * 管理操作日志拦截器（P2-15）：记录 /api/admin 下的写操作。
 * 仅对管理端变更类请求落库 operation_logs，查询类请求不记录。
 */
@Injectable()
export class OperationLogInterceptor implements NestInterceptor {
  constructor(private readonly accountSvc: AdminAccountService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const method: string = req.method;
    const url: string = req.originalUrl || req.url || '';

    const isAdminWrite =
      MUTATING.has(method) &&
      url.includes('/admin/') &&
      !url.includes('/admin/login');
    if (!isAdminWrite) return next.handle();

    const started = Date.now();
    const user: JwtPayload | undefined = req.user;

    return next.handle().pipe(
      tap({
        next: () => this.write(context, req, method, url, started, user),
        error: () => this.write(context, req, method, url, started, user),
      }),
    );
  }

  private write(
    context: ExecutionContext,
    req: any,
    method: string,
    url: string,
    started: number,
    user?: JwtPayload,
  ) {
    if (!user || user.type !== 'admin') return;
    const res = context.switchToHttp().getResponse();
    const path = url.split('?')[0];
    const seg = path.replace(/^.*\/admin\//, '').split('/')[0] || 'admin';
    void this.accountSvc.record({
      adminId: user.sub,
      username: '',
      module: seg,
      action: `${method} ${path}`,
      method,
      path,
      params: this.sanitize(req.body),
      ip: req.ip || '',
      userAgent: req.headers?.['user-agent'] || '',
      statusCode: res?.statusCode ?? 0,
      durationMs: Date.now() - started,
    });
  }

  private sanitize(body: unknown): Record<string, unknown> | null {
    if (!body || typeof body !== 'object') return null;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      out[k] = SENSITIVE.includes(k) ? '***' : v;
    }
    return out;
  }
}
