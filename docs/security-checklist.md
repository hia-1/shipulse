# 安全检查清单与整改记录（P2-16 · 16-1）

- **范围**：`backend`（NestJS 模块化单体）、`web-user` / `web-admin`（Vue SPA）、`miniprogram`（微信小程序）、`nginx`（反向代理）
- **依据**：《功能需求.md》⑧ 非功能需求、⑨ 验收标准（安全）
- **核查方式**：源码审计 + 本地实测 + 配置复核
- **结论**：P0/P1 风险项已整改闭环；剩余为上线前置的环境/证书类事项（标注「上线前必做」）。

## 一、核查结论总览

| # | 检查项 | 结论 | 证据 / 位置 |
|---|--------|------|-------------|
| 1 | 传输安全（HTTPS/HSTS） | ⚠️ 配置就绪，上线前启用 | `nginx/conf.d/ssl.conf.template`、`backend/src/main.ts` HSTS |
| 2 | 安全响应头 | ✅ 通过 | `backend/src/main.ts`、`nginx/conf.d/user.conf` |
| 3 | SQL 注入 | ✅ 通过 | 全部使用 TypeORM 参数化 / `?` 占位符 |
| 4 | XSS（存储型/反射型） | ✅ 已整改 | 新增 `common/utils/sanitize.ts` 并接入全部 UGC 写入路径 |
| 5 | CSRF | ✅ 通过（不适用） | 鉴权走 Bearer JWT，无 Cookie 会话 |
| 6 | 接口限流 | ✅ 已整改 | 全局 100/min + 关键写接口 `@Throttle` 全覆盖 |
| 7 | 防刷风控（打卡/试用/兑换码） | ✅ 通过 | 业务幂等 + 限流双保险 |
| 8 | 敏感信息脱敏 | ✅ 通过 | `admin-user.service.ts` `maskPhone`；异常过滤器不外泄内部细节 |
| 9 | URL 白名单 / 危险协议 | ✅ 通过 | `IsHttpUrl` / `IsSafeLink` 自定义校验器 |
| 10 | 认证与令牌安全 | ✅ 通过 | 令牌版本号 + refresh 类型校验 + 生产密钥自检 |
| 11 | 越权访问（IDOR） | ✅ 通过 | 写操作均校验资源归属 |
| 12 | 配置与密钥管理 | ✅ 通过 | 生产强制校验 JWT_SECRET / DB_PASSWORD / 默认超管口令 |
| 13 | 错误处理与日志 | ✅ 通过 | 统一异常过滤器，5xx 仅落日志 |
| 14 | 文件上传 | ✅ 不适用 | 无上传接口，图片一律以 URL 存储并校验协议 |
| 15 | 依赖安全（CVE 扫描） | ⚠️ 上线前必做 | 由 CI 流水线 `npm audit` 承接（见 16-3） |

## 二、逐项说明与整改

### 1. 传输安全（HTTPS / HSTS）
- 现状：默认 `docker-compose` 的 nginx 仅监听 80/81（本地联调）；已提供生产 HTTPS 模板 `nginx/conf.d/ssl.conf.template`（HTTP→HTTPS 301 跳转、用户端 :443、管理端 :444）。
- 加固：`nginx/nginx.conf` 统一声明 `ssl_protocols TLSv1.2 TLSv1.3`、禁用弱套件、关闭 `server_tokens`；后端在生产环境下发 `Strict-Transport-Security`。
- **上线前必做**：放置证书到 `nginx/certs/`，复制模板为 `ssl.conf`，按模板注释调整 compose 端口与挂载，替换示例域名。

### 2. 安全响应头
- 后端中间件统一下发 `X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、`Referrer-Policy: no-referrer`、`X-DNS-Prefetch-Control: off`、`Cross-Origin-Resource-Policy: same-site`；生产追加 HSTS。
- nginx 静态资源 server 同步下发 nosniff / X-Frame-Options / Referrer-Policy，避免 HTML 入口缺失保护。

### 3. SQL 注入
- 全仓仅 3 处原生 SQL，均为参数化占位符：
  - `backend/src/main.ts:60` 生产自检查询（参数绑定）
  - `membership.service.ts:198` / `post.service.ts:85` 行锁 `SELECT ... WHERE id = ? FOR UPDATE`（参数绑定）
- 其余数据访问统一走 TypeORM Repository / QueryBuilder（命名参数 `:param`）。**未发现字符串拼接 SQL**。

### 4. XSS（已整改）
- 出口侧：`web-user` / `web-admin` 未使用 `v-html` / `innerHTML`；小程序未使用 `rich-text`，文本绑定默认转义。
- 入口侧（纵深防御，本次新增）：
  - 新增 `backend/src/common/utils/sanitize.ts`：`stripHtmlTags` / `sanitizeText`，剥离 HTML 标签与控制字符。
  - 接入全部 UGC 写入路径：书评（标题/正文）、评论、图文动态与打卡（正文/位置）、书单（标题/简介）、用户昵称/简介。
  - 机审在清洗后的文本上进行，避免标签绕过关键词命中。

### 5. CSRF
- 鉴权使用 `Authorization: Bearer <JWT>`，不依赖 Cookie 会话，浏览器不会自动携带凭证 → CSRF 不适用。
- CORS 仅放行配置来源（`CORS_ORIGINS`），方法限定 GET/POST/PUT/PATCH/DELETE/OPTIONS，头部限定 Content-Type/Authorization。

### 6. 接口限流（已整改）
- 全局：`ThrottlerModule` 默认 100 次/分钟/IP；超限统一返回「请求过于频繁，请稍后再试」。
- **TTL 单位约定**：`@nestjs/throttler` v4 的 `ttl` 参数单位为**秒**（内部按 `ttl × 1000` 转为毫秒）。全局配置与所有 `@Throttle(limit, ttl)` 均使用秒（如 `@Throttle(10, 60)` = 10 次/分钟），切勿再传入 `60000`，否则窗口会被放大 1000 倍（≈16.7 小时）。
- 关键写接口按风险分级配置 `@Throttle`：

| 模块 | 接口 | 限流 |
|------|------|------|
| auth | 注册 / 登录 | 10/min |
| auth | 刷新令牌 | 20/min |
| admin | 管理员登录 | 10/min |
| admin | 修改密码 | 5/min |
| admin | 手动开通会员 / 批量生成兑换码 | 20 / 10 每分钟 |
| membership | 创建订单 / 沙箱支付 | 10/min |
| membership | 新用户试用 | 3/min |
| membership | 兑换码核销 | 5/min（防爆破） |
| post | 打卡 / 发布动态 | 10/min |
| post | 点赞 / 删除 | 60 / 20 每分钟 |
| community | 发书评 / 发评论 | 10 / 20 每分钟 |
| community | 点赞 / 删除书评 | 60 / 20 每分钟 |
| reading | 开始 / 结束场次 | 20 / 30 每分钟 |
| reading | 导出 CSV | 5/min |
| booklist | 创建 / 编辑 / 删除 | 10 / 20 / 20 每分钟 |
| booklist | 增删书目 / 收藏 | 30 / 60 每分钟 |
| incentive | 设定/更新目标、徽章检查 | 10 / 20 / 10 每分钟 |
| user | 编辑资料 / 注销账号 | 20 / 3 每分钟 |
| search | 记录搜索 | 20/min |
| library(admin) | 建/改/删书籍、ISBN 拉取 | 20 / 30 / 20 / 20 每分钟 |

### 7. 防刷风控
- 打卡：`post.service.ts` 事务 + 用户行锁串行化，配合「当日已打卡」唯一性校验，杜绝并发重复打卡；叠加 10/min 限流。
- 试用：`membership.trial` 服务端校验「仅一次」，叠加 3/min 限流。
- 兑换码：一次性核销 + 5/min 限流，防枚举爆破。

### 8. 敏感信息脱敏
- 管理端用户列表手机号经 `maskPhone` 输出为 `138****0001`，不返回明文。
- 认证响应经 `sanitizeUser` 白名单字段输出，不含密码哈希、令牌版本等敏感字段。
- 统一异常过滤器对非预期异常仅返回通用文案，详情（含 SQL/路径）只落服务端日志。

### 9. URL 白名单 / 危险协议
- `common/validators/custom-validators.ts`：
  - `IsHttpUrl`：仅允许 http/https 绝对地址，拒绝 `javascript:` / `data:` / 协议相对 `//`；用于头像、封面、配图、Banner 图片等。
  - `IsSafeLink`：Banner 跳转值仅允许站内相对路径 / http(s) / 纯数字 ID。
- 全局 `ValidationPipe` 开启 `whitelist` + `forbidNonWhitelisted`，未知字段直接拒绝。

### 10. 认证与令牌安全
- Access / Refresh 双令牌，`tokenType` 显式校验，拒绝用 access 令牌续期。
- 令牌版本号（`tv`）：登出、封禁、注销、改密均使旧令牌立即失效。
- 登录失败不区分「未注册/账号异常」，规避手机号枚举。
- 生产环境启动自检：`JWT_SECRET`、`DB_PASSWORD` 不得为默认值；检测到内置默认超管口令（admin/admin123）拒绝启动。

### 11. 越权访问（IDOR）
- 写操作均先校验资源归属：书单 `owned(userId, id)`、书评/动态/评论删除校验 `user_id`、阅读场次校验归属；管理端接口统一 `AdminGuard` + `@AdminArea`。

### 12. 配置与密钥管理
- `.env.dev/.test/.prod` 分离；`.gitignore` 排除本地密钥文件。
- 生产启动强制校验默认密钥（见第 10 项）。

### 13. 错误处理与日志
- `AllExceptionsFilter` 统一响应结构 `{ code, message, data }`，5xx 不回传堆栈。
- `LoggingInterceptor` 记录请求日志。

### 14. 文件上传
- 无上传接口；图片/头像/封面均以 URL 形式提交，经 `IsHttpUrl` 校验协议，无本地落盘与路径穿越风险。

### 15. 依赖安全（上线前必做）
- 由 CI 流水线执行 `npm audit --audit-level=high`，高危未修复则阻断构建（见 16-3）。

## 三、遗留与上线前置事项

1. **【上线前必做】** 启用 HTTPS：证书落位 + `ssl.conf` 生效 + 移除明文业务入口。
2. **【上线前必做】** 生产接入真实短信验证码服务（当前 prod 未配置，登录/注册会明确报错，不会静默放行）。
3. **【上线前必做】** 生产接入真实内容安全 API（腾讯天御）替换本地关键词 Mock。
4. **【建议】** 管理端在 nginx 层叠加 IP 白名单。
5. **【建议】** 引入 WAF / 云防护，配置异常流量告警（见 16-2）。
