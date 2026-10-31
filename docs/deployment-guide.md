# 部署手册（P2-16 · 16-5）

> 时脉书社-阅读世界 · 模块化单体（NestJS + MySQL + Redis）+ 双 Vue SPA + 微信小程序
> 本文档面向运维/交付，可照此独立完成 dev / test / prod 三环境部署。

## 一、系统架构

```
                    ┌─────────────── nginx（80/443/444）───────────────┐
   浏览器/小程序 ───▶│  /            → web-user 静态站（SPA）            │
                    │  /admin       → web-admin 静态站（SPA）           │
                    │  /api/  /health → backend:3000（NestJS）         │
                    └──────────────────────┬───────────────────────────┘
                                           │
                              ┌────────────┴────────────┐
                              ▼                         ▼
                        MySQL 8.0                   Redis 7
```

| 组件 | 目录 | 技术栈 | 端口 |
|------|------|--------|------|
| 后端 API | `backend/` | NestJS 10 + TypeORM | 3000 |
| 用户端 Web | `web-user/` | Vue3 + Vite + Pinia + Tailwind | 构建为静态文件 |
| 管理端 Web | `web-admin/` | Vue3 + Vite + Element Plus | 构建为静态文件 |
| 微信小程序 | `miniprogram/` | 原生小程序 | — |
| 反向代理 | `nginx/` | nginx 1.27 | 80/443/444 |
| 数据库脚本 | `db/init/` | MySQL 8.0 | 3306 |
| 运维脚本 | `scripts/` | sh / node | — |

## 二、环境要求

- **服务器**：Linux（推荐 Ubuntu 22.04 / CentOS 7+），2C4G 起（生产建议 4C8G）
- **容器**：Docker 24+ 与 Docker Compose v2
- **Node.js**：20 LTS（仅本地/CI 构建需要）
- **域名与证书**：生产需已备案域名 + TLS 证书（`fullchain.pem` / `privkey.pem`）
- **网络**：MySQL/Redis 仅内网可达，不对公网暴露

## 三、目录与配置

### 3.1 获取代码

```bash
git clone <repo-url> /opt/shipulse
cd /opt/shipulse
```

### 3.2 环境变量

按环境复制模板并填写：

```bash
cp .env.example .env.prod     # 生产
# 测试：cp .env.example .env.test
# 开发：cp .env.example .env.dev
```

**生产必填项（缺一不可，否则后端拒绝启动）**：

| 变量 | 说明 |
|------|------|
| `NODE_ENV` | 必须为 `prod` |
| `JWT_SECRET` | 强随机字符串（≥32 位），禁用默认 `change_me` |
| `DB_PASSWORD` / `DB_ROOT_PASSWORD` | 真实数据库密码 |
| `CORS_ORIGINS` | 允许的前端来源，逗号分隔 |
| `TRUST_PROXY` | 置于 nginx 后时保持默认（prod 自动信任 1 跳代理） |
| `THROTTLE_LIMIT` / `THROTTLE_TTL` | 全局限流（默认 100 次/分钟/IP） |
| `ALERT_WEBHOOK` | 企业微信告警机器人 webhook（运维告警） |
| `BACKUP_DIR` / `RETENTION_DAYS` | 备份目录与保留天数（默认 7 天） |

> ⚠️ 生产环境后端启动时会自检：若 `JWT_SECRET`/`DB_PASSWORD` 仍为默认值，或数据库中仍存在内置默认超管口令（admin/admin123），进程会**拒绝启动**。

## 四、首次部署（全量）

```bash
# 1. 构建前端静态产物
npm run build:web-user
npm run build:web-admin

# 2. 启动数据库/缓存（首次会自动执行 db/init 下的建表与种子脚本）
docker compose --env-file .env.prod up -d mysql redis

# 3. 等待 MySQL 健康后启动后端与 nginx
docker compose --env-file .env.prod up -d --build backend nginx

# 4. 验证
curl -f http://127.0.0.1:3000/health
```

首次启动说明：
- `db/init/01_schema.sql` 建表，`02_seed_reference.sql` 基础字典，`03_seed_demo.sql` 演示数据。
- **仅在数据卷首次创建时执行**；如需重新初始化，先 `docker compose down -v`（会清空数据，谨慎）。

## 五、三环境部署

| 环境 | 用途 | 分支/触发 | 环境变量文件 | 说明 |
|------|------|-----------|--------------|------|
| dev | 开发联调 | 本地 | `.env.dev` | 本机直跑前后端，仅容器跑 MySQL/Redis |
| test | 测试验收 | `develop` 分支 / 手动 | `.env.test` | 完整容器编排 |
| prod | 生产 | `main` 分支 / tag `v*` | `.env.prod` | 完整容器编排 + HTTPS + 备份告警 |

**开发联调**：

```bash
docker compose up -d mysql redis        # 仅起依赖
npm run dev:backend                     # 后端 :3000
npm run dev:web-user                    # 用户端 :5173
npm run dev:web-admin                   # 管理端 :5174
```

## 六、HTTPS 启用（生产必做）

1. 证书落位：`nginx/certs/fullchain.pem`、`nginx/certs/privkey.pem`
2. 启用 TLS 配置：
   ```bash
   cp nginx/conf.d/ssl.conf.template nginx/conf.d/ssl.conf
   # 编辑 ssl.conf，替换 server_name 为真实域名
   ```
3. 调整 `docker-compose.yml` 的 nginx 服务：
   ```yaml
   ports: ['80:80', '443:443', '444:444']
   volumes:
     - ./nginx/certs:/etc/nginx/certs:ro
   ```
4. 移除/改造 `user.conf`、`admin.conf` 中的明文业务入口（保留 80 仅做跳转）。
5. 重启：`docker compose --env-file .env.prod up -d nginx`

TLS 加固参数（TLS1.2/1.3、禁用弱套件、关闭 `server_tokens`）已在 `nginx/nginx.conf` 统一声明。

## 七、备份与告警（生产必做）

### 7.1 数据库每日备份 + 7 天轮转

```bash
chmod +x scripts/*.sh
# 手动验证一次
./scripts/backup-db.sh
```

配置 crontab（每日 03:30）：

```cron
30 3 * * * /opt/shipulse/scripts/backup-db.sh >> /var/log/shipulse-backup.log 2>&1
```

- 备份产物：`$BACKUP_DIR/shipulse_YYYYMMDD_HHMMSS.sql.gz`
- 自动删除超过 `RETENTION_DAYS`（默认 7）天的备份
- 配置 `OSS_SYNC_CMD` 可启用对象存储异地副本

### 7.2 故障告警

```cron
*/2 * * * * /opt/shipulse/scripts/healthcheck.sh >> /var/log/shipulse-health.log 2>&1
```

- 探测后端 `/health`、MySQL/Redis 容器存活、根分区磁盘水位（≥90%）
- 异常时经 `scripts/alert.sh` 推送企业微信 / 邮件
- 备份失败、部署失败同样会触发告警

### 7.3 恢复演练

```bash
gunzip -c /var/backups/shipulse/shipulse_20261007_033000.sql.gz | \
  docker exec -i shipulse-mysql mysql -uroot -p"$DB_ROOT_PASSWORD" shipulse
```

## 八、CI/CD（GitHub Actions）

| 流水线 | 文件 | 触发 | 内容 |
|--------|------|------|------|
| CI | `.github/workflows/ci.yml` | push/PR 到 main、develop | 后端类型检查+构建、双前端构建、`npm audit`（生产依赖高危阻断） |
| Deploy | `.github/workflows/deploy.yml` | 手动选择环境 / tag `v*` | 构建并推送后端镜像到 GHCR → SSH 部署 → 健康检查 → 失败告警 |

**需在 GitHub 仓库配置的 Secrets / Environments**：

| 名称 | 说明 |
|------|------|
| `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY` | 部署目标 SSH 信息 |
| `DEPLOY_PATH` | 服务器上项目目录（如 `/opt/shipulse`） |
| `REGISTRY_USER` / `REGISTRY_PASSWORD` | 镜像仓库凭证（GHCR 可用 PAT） |
| `HEALTH_URL` | 部署后健康检查地址 |
| `ALERT_WEBHOOK` | 部署失败告警 webhook |

建议为 `prod` 环境在 GitHub Environments 中配置**必需审批人**，实现发布卡点。

> 提示：仓库尚未 `git init`。首次接入 CI 前执行：
> ```bash
> git init && git add . && git commit -m "chore: 初始化仓库"
> git remote add origin <repo-url> && git push -u origin main
> ```

## 九、升级与回滚

**升级**：
```bash
git pull
npm run build:web-user && npm run build:web-admin
docker compose --env-file .env.prod up -d --build backend nginx
```

**回滚**（镜像方式）：将 `BACKEND_IMAGE` 指向上一版本镜像 tag 后重启：
```bash
BACKEND_IMAGE=ghcr.io/<owner>/<repo>/backend:<old-sha> \
  docker compose --env-file .env.prod up -d --no-deps backend
```

## 十、健康检查与排障

| 现象 | 排查 |
|------|------|
| 后端启动即退出并打印「[安全]…」 | 生产默认密钥/默认超管口令未修改，按提示整改 |
| 502 Bad Gateway | 后端未就绪或崩溃：`docker compose logs -f backend` |
| 登录/注册报「短信验证码服务暂未配置」 | 生产短信服务未接入（预期行为，非静默失败） |
| 请求频繁返回 429 | 触发全局限流；确认 `TRUST_PROXY` 使限流按真实 IP 计数 |
| 数据库连不上 | 检查 `DB_*` 变量与 mysql 健康状态：`docker compose ps` |

关键端点：`GET /health`（存活）、`GET /api/docs`（Swagger，仅非生产环境挂载）。

## 十一、交付物清单

| 交付物 | 位置 |
|--------|------|
| 部署手册 | `docs/deployment-guide.md`（本文） |
| 管理端操作手册 | `docs/admin-manual.md` |
| Swagger 接口文档 | `docs/openapi.json` + 运行时 `/api/docs` |
| 安全检查清单 | `docs/security-checklist.md` |
| 压测报告 | `docs/loadtest-report.md` |
| CI/CD 配置 | `.github/workflows/ci.yml`、`deploy.yml` |
| 运维脚本 | `scripts/backup-db.sh`、`alert.sh`、`healthcheck.sh`、`loadtest.mjs` |
