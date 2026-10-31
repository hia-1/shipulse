import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

const NODE_ENV = process.env.NODE_ENV || 'dev';
// 初始化脚本内置的默认超管口令哈希（admin/admin123），生产环境必须已修改
const DEFAULT_ADMIN_HASH =
  '$2a$10$QZkI4Nb7OLnnFzZki980YuszPuloRR1WcVVmv2dtXz7AG9tj8Rtza';
// 生产环境不允许使用占位密钥，避免用默认 secret 部署导致身份伪造
if (NODE_ENV === 'prod') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change_me') {
    throw new Error('[安全] 生产环境必须设置强随机 JWT_SECRET，禁止使用默认值');
  }
  if (!process.env.DB_PASSWORD || process.env.DB_PASSWORD === 'change_me') {
    throw new Error('[安全] 生产环境必须设置真实数据库密码，禁止使用默认值');
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 反向代理（nginx）场景下信任 X-Forwarded-For，使限流按真实客户端 IP 计数。
  // 否则 req.ip 恒为代理地址，全站用户共用一个限流桶。生产默认信任 1 跳代理，
  // 可通过 TRUST_PROXY 覆盖（数字跳数 / 'loopback' / 'false' 关闭）。
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy && trustProxy !== 'false') {
    app.getHttpAdapter().getInstance().set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  } else if (trustProxy === undefined && NODE_ENV === 'prod') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  // 安全响应头（不引入额外依赖）：防 MIME 嗅探 / 点击劫持 / Referer 泄露；生产启用 HSTS
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    if (NODE_ENV === 'prod') {
      res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }
    next();
  });

  app.setGlobalPrefix('api', { exclude: ['health'] });

  const configService = app.get(ConfigService);
  app.enableCors({
    origin: configService.get<string[]>('cors.origin') ?? [], // 仅允许配置的站前/管理端来源
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // 生产环境自检：若仍存在内置默认超管口令，拒绝启动，避免被已知口令接管后台
  if (NODE_ENV === 'prod') {
    const dataSource = app.get(DataSource);
    const rows: Array<{ c: number | string }> = await dataSource.query(
      'SELECT COUNT(*) AS c FROM admins WHERE password_hash = ?',
      [DEFAULT_ADMIN_HASH],
    );
    if (Number(rows[0]?.c ?? 0) > 0) {
      throw new Error(
        '[安全] 检测到默认管理员口令（admin/admin123），生产环境请先修改超管密码后再启动',
      );
    }
  }

  // Swagger 文档仅在非生产环境挂载，避免线上暴露完整 API 结构（含管理端接口）
  if (NODE_ENV !== 'prod') {
    const config = new DocumentBuilder()
      .setTitle('时脉书社-阅读世界 API')
      .setDescription('模块化单体后端：用户/书库/阅读/社区/会员/管理六模块')
      .setVersion('0.1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description: '输入 Bearer JWT 令牌',
          in: 'header',
        },
        'access-token',
      )
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = Number(process.env.APP_PORT || 3000);
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`listening on http://localhost:${port}`);
  if (NODE_ENV !== 'prod') {
    logger.log(`swagger on http://localhost:${port}/api/docs`);
  }
}
bootstrap();
