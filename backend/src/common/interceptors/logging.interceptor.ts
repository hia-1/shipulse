import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, path, ip } = request;
    const ua = request.headers['user-agent'] || '';
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const statusCode = context.switchToHttp().getResponse().statusCode;
          this.logger.log(
            `${method} ${path} ${statusCode} ${Date.now() - now}ms ${ip} ${ua}`,
          );
        },
        error: (err) => {
          this.logger.error(
            `${method} ${path} ERROR ${Date.now() - now}ms - ${err.message}`,
          );
        },
      }),
    );
  }
}
