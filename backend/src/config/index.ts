// 在 ConfigModule 加载 .env 文件之前捕获进程启动时的真实 NODE_ENV。
// 若生产部署漏设 NODE_ENV，.env.dev 会把 process.env.NODE_ENV 回填成 dev，
// 因此必须以"启动时显式声明"为准，避免开发专用能力（固定验证码/沙箱支付）被静默放行。
const rawNodeEnv = process.env.NODE_ENV;

export default () => ({
  nodeEnv: rawNodeEnv || 'production',
  isDev: rawNodeEnv === 'dev',
  port: parseInt(process.env.APP_PORT || '3000', 10),
  database: {
    type: 'mysql' as const,
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USER || 'shipulse',
    password: process.env.DB_PASSWORD || 'change_me',
    database: process.env.DB_NAME || 'shipulse',
    autoLoadEntities: true,
    synchronize: false,
    timezone: '+08:00',
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'change_me',
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '2h',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '30d',
  },
  wechat: {
    appId: process.env.WECHAT_APPID || '',
    appSecret: process.env.WECHAT_SECRET || '',
    // 仅开发环境且未配置真实凭证时启用 mock 适配器（无需小程序凭证即可联调）。
    // 生产环境即使漏配凭证也绝不 mock，避免任意手机号被冒名登录。
    mock:
      process.env.WECHAT_MOCK === 'true' ||
      (rawNodeEnv === 'dev' && !process.env.WECHAT_APPID),
    // 订阅消息模板ID（逗号分隔）。真实凭证下从微信公众平台「订阅消息」获取；
    // 未配置时由订阅服务回退到开发占位模板，保证授权/发送链路可联调。
    subscribeTemplateIds: (process.env.WECHAT_TEMPLATE_IDS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },
  throttler: {
    // 全局限流：默认 100 次/分钟/IP（TTL 单位为「秒」，与 @nestjs/throttler 语义一致），
    // 可按环境通过 THROTTLE_LIMIT / THROTTLE_TTL 调整
    ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
  },
  cors: {
    origin: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },
});
