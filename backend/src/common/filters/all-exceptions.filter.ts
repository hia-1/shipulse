import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, any>;
        if (Array.isArray(r.message)) {
          message = r.message.join('; ');
        } else {
          message = r.message || exception.message;
        }
      }
      if (status === HttpStatus.TOO_MANY_REQUESTS) {
        message = '请求过于频繁，请稍后再试';
      }
    } else if (exception instanceof Error) {
      // 非预期异常：详情只落日志，对外统一通用文案，避免泄露 SQL/路径等内部实现细节
      this.logger.error(`Unhandled: ${exception.message}`, exception.stack);
    }

    response.status(status).json({ code: status, message, data: null });
  }
}
