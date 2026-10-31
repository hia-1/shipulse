# 时脉书社-阅读世界 · 工程仓库

> 记录每一次阅读的脉动
> 用户端微信小程序 + 用户端 Web 网站 + Web 管理端（三端共用后端，模块化单体）

## 目录结构

```
├── backend/        Node.js + NestJS + TypeScript（模块化单体：用户/书库/阅读/社区/会员/管理）
├── web-user/       Vue3 + Vite + Pinia + TailwindCSS（用户端 Web 站，:5173）
├── web-admin/      Vue3 + Vite + Element Plus（Web 管理端，:5174）
├── miniprogram/    原生微信小程序（用微信开发者工具导入本目录）
├── nginx/          Nginx 配置（用户站 :80 / 管理端 :81 / 反代后端）
├── db/init/        数据库初始化脚本目录（P0-03 产出，MySQL 容器首启自动执行）
├── docker-compose.yml
├── .env.example    环境变量模板（复制为 .env.dev / .env.test / .env.prod）
└── scripts/        辅助脚本
```

## 环境要求

- Node.js >= 18（推荐 20 LTS）
- Docker + Docker Compose（MySQL 8.0 / Redis / Nginx 编排）
- 微信开发者工具（小程序端）

## 快速开始（本机直跑）

```bash
# 0. 准备环境变量（首次）
cp .env.example .env.dev   # 按需修改 DB_PASSWORD / JWT_SECRET 等占位值

# 1. 基础设施（仅拉起 MySQL + Redis）
docker compose up -d mysql redis

# 2. 后端（:3000，健康检查 /health，Swagger /api/docs）
cd backend && npm install && npm run start:dev

# 3. 用户端 Web（:5173，/api 已代理到后端）
cd web-user && npm install && npm run dev

# 4. 管理端（:5174）
cd web-admin && npm install && npm run dev

# 5. 小程序：微信开发者工具导入 miniprogram/ 目录
#    联调本机后端时勾选「不校验合法域名」；结构自检：node scripts/check-miniprogram.js
```

## Docker 全量部署

```bash
# 先构建两个前端产物（Nginx 挂载静态文件）
npm run build:web-user
npm run build:web-admin

# 一键拉起（应用 + MySQL + Redis + Nginx）
docker compose --env-file .env.prod up -d --build
```

- 用户站：`http://localhost:${NGINX_HTTP_PORT:-8080}`
- 管理端：`http://localhost:${NGINX_ADMIN_PORT:-8081}`
- 后端健康检查：`http://localhost:8080/health`

## 环境变量约定

| 变量 | 说明 |
| --- | --- |
| `NODE_ENV` | dev / test / prod 三环境隔离 |
| `APP_PORT` | 后端端口（默认 3000） |
| `DB_*` | MySQL 8.0 连接（utf8mb4 + InnoDB） |
| `REDIS_*` | Redis 连接 |
| `JWT_SECRET` / `JWT_ACCESS_EXPIRES` / `JWT_REFRESH_EXPIRES` | JWT AccessToken + RefreshToken |
| `NGINX_HTTP_PORT` / `NGINX_ADMIN_PORT` | Nginx 对外端口 |

> 安全约定：仅提交 `.env.example` 与占位模板；真实密钥一律不入库。

## 接口约定

- 业务接口统一前缀 `/api`；健康检查 `/health`（不带前缀）。
- Swagger 文档：`http://localhost:3000/api/docs`。
