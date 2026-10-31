# 数据库说明（Schema / ER）· 时脉书社-阅读世界

> P0-03 产物。表结构以《功能需求.md》⑦ 数据库设计为准绳，共 **38 张表**（含 3 张二期预留表）。
> 平台：MySQL 8.0 · InnoDB · utf8mb4 / utf8mb4_unicode_ci。

---

## 1. 文件与执行

| 文件 | 内容 | 幂等方式 |
| --- | --- | --- |
| `db/init/01_schema.sql` | 38 张表 DDL，按外键依赖排序 | `CREATE TABLE IF NOT EXISTS` |
| `db/init/02_seed_reference.sql` | 分类/标签/徽章/套餐/角色/超管 | 固定 ID + `ON DUPLICATE KEY UPDATE` |
| `db/init/03_seed_demo.sql` | 全链路演示数据 | 固定 ID + `INSERT IGNORE` |

- Docker：`db/init` 已挂载到 MySQL 容器 `/docker-entrypoint-initdb.d`，**仅首次创建数据卷时自动按文件名顺序执行**。
- 手动执行：`mysql -h127.0.0.1 -uxxx -p shipulse < db/init/01_schema.sql`（再依次执行 02、03），可重复执行。
- 重置：`docker compose down -v` 删除数据卷后重新 `up`。

## 2. 全局约定

- 主键：`id BIGINT UNSIGNED AUTO_INCREMENT`。
- 时间：`created_at/updated_at DATETIME(3)`（毫秒精度，默认当前时间，更新自动刷新）。
- 软删除：业务表带 `deleted_at DATETIME(3) NULL`；**例外**（有意为之，非疏漏）：
  - 纯关联表（book_tags / booklist_items / likes / follows / admin_roles / user_badges / event_signups）仅 `created_at`，直接物理增删；
  - 只追加表（notifications / conversations / messages / payment_records / moderation_logs / operation_logs）无 `updated_at/deleted_at`；
  - 财务与权益凭证表（orders / member_subscriptions / redeem_codes）不做软删除，仅靠状态字段流转——订阅「到期保留数据、续费恢复」，凭证须全程留痕；
  - 账号绑定表 user_auths 随用户生命周期级联清除，不单独软删；
  - users 注销按合规要求做物理清除（或匿名化），`status='canceled'` 为中间态。
- 金额：一律以「分」存储，`INT UNSIGNED`（字段名后缀 `_fen`）。
- 评分：`reviews.rating DECIMAL(2,1)`（0.5 步进，0.5–5.0）；`books.rating_avg DECIMAL(3,2)`。
- 分享短码：reviews / booklists / posts / books 带 `short_code VARCHAR(16)`（NULL + 唯一索引，对外链接不暴露自增 ID）。
- 多态关联：comments / likes / reports / moderation_logs 用 `target_type + target_id`，**不建物理外键**，由应用层保证；其余强归属关系建物理外键。
- 枚举：状态字段用 `VARCHAR` + 表注释枚举（便于扩展与种子可读），应用层以常量约束。
- 冗余计数：`*_count`、`rating_avg` 等异步更新（业务事件 + 定时校正），热榜另走 Redis。

## 3. 表清单（38 张）

| 域 | 表 | 说明 |
| --- | --- | --- |
| 用户域 | users | 用户（手机号三端统一标识） |
| 用户域 | user_auths | 授权方式：phone / wechat_web / wechat_mp |
| 用户域 | badges | 徽章定义 |
| 用户域 | user_badges | 用户已获徽章 |
| 书库域 | categories | 两级分类（parent_id=0 为一级） |
| 书库域 | tags | 标签 |
| 书库域 | books | 图书（ISBN 唯一、短码、三态计数、全文索引） |
| 书库域 | book_tags | 图书-标签多对多 |
| 书库域 | bookshelves | 书架：want/reading/read + 进度 |
| 阅读域 | reading_sessions | 阅读场次（计时/页码/笔记，时脉数据源） |
| 阅读域 | reading_goals | 年度/月度目标 |
| 社区域 | reviews | 书评（半星评分 + 机审状态机 + 短码） |
| 社区域 | booklists | 书单 |
| 社区域 | booklist_items | 书单条目 |
| 社区域 | posts | 打卡/图文动态（可挂书、挂话题） |
| 社区域 | comments | 多态评论（review/post/booklist，两级） |
| 社区域 | likes | 多态点赞；`interaction_type='collect'` 兼作书单收藏 |
| 社区域 | follows | 关注关系（**二期预留**） |
| 会员域 | membership_plans | 套餐（月卡/年卡） |
| 会员域 | orders | 订单（order_no 唯一，财务不删） |
| 会员域 | member_subscriptions | 订阅（试用/有效/到期/取消 + 续费 + 三级提醒标记） |
| 会员域 | payment_records | 支付流水（只追加，对账依据） |
| 会员域 | redeem_codes | 兑换码 |
| 消息域 | notifications | 站内通知（like/comment/follow/system/order/audit） |
| 消息域 | conversations | 私信会话（**二期预留**） |
| 消息域 | messages | 私信消息（**二期预留**） |
| 运营域 | banners | Banner 运营位（位置 + 上下线时间窗） |
| 运营域 | topics | 话题 |
| 运营域 | columns | 每周好书 / 编辑专栏（表名为保留字，已反引号） |
| 运营域 | events | 活动/共读营（会员专属、名额、报名窗口） |
| 运营域 | event_signups | 活动报名 |
| 管理域 | admins | 管理员（bcrypt 密码） |
| 管理域 | roles | 角色（permissions JSON 权限点） |
| 管理域 | admin_roles | 管理员-角色多对多 |
| 管理域 | reports | 举报（状态机 + 处理留痕） |
| 管理域 | moderation_logs | 审核/处罚日志（机审+人工，只追加） |
| 管理域 | operation_logs | 管理员操作日志（只追加） |
| 管理域 | feedback | 意见反馈 |

## 4. 核心关系（ER 概要）

```
users ──< user_auths
users ──< user_badges >── badges
users ──< bookshelves >── books ──< book_tags >── tags
books ──> categories(自关联两级)
users ──< reading_sessions >── books（bookshelf_id 软关联 bookshelves）
users ──< reading_goals
users ──< reviews >── books
users ──< booklists ──< booklist_items >── books
users ──< posts >── books / topics
users ──< comments（多态 target: review/post/booklist，两级 parent_id）
users ──< likes（多态 target: review/post/comment/booklist；collect=书单收藏）
users ──< follows（二期预留，自关联多对多）

membership_plans ──< orders ──< payment_records
membership_plans ──< member_subscriptions >── users / orders
membership_plans ──< redeem_codes >── users / orders / admins

users ──< notifications
users ──< conversations ──< messages（二期预留，自关联多对多）

admins ──< admin_roles >── roles
admins ── 处理 reports / feedback；创建 books / banners / columns / events / redeem_codes
events ──< event_signups >── users
```

## 5. 状态枚举速查

| 表.字段 | 取值 |
| --- | --- |
| users.status | `active` / `muted` / `banned` / `canceled` |
| user_auths.identity_type | `phone` / `wechat_web` / `wechat_mp` |
| books.status | `pending` / `on_shelf` / `off_shelf` |
| bookshelves.status | `want` / `reading` / `read` |
| reading_sessions.status | `ongoing` / `finished`；source：`web` / `miniprogram` |
| reading_goals.goal_type / .status | `yearly` / `monthly`；`active` / `achieved` / `archived` |
| reviews / booklists / posts.audit_status | `pending` / `approved` / `rejected` |
| posts.type | `checkin` / `text` |
| comments.target_type | `review` / `post` / `booklist` |
| likes.target_type / interaction_type | `review` / `post` / `comment` / `booklist`；`like` / `collect` |
| orders.order_type / .status | `subscription` / `redeem`；`pending` / `paid` / `closed` / `refunded` |
| payment_records.status | `pending` / `success` / `failed` / `refunded` |
| member_subscriptions.status / .channel | `trialing` / `active` / `expired` / `canceled`；`wechat` / `redeem` / `trial` |
| redeem_codes.status | `unused` / `used` / `disabled` / `expired` |
| notifications.type | `like` / `comment` / `follow` / `system` / `order` / `audit` |
| columns.type / .status | `weekly_pick` / `column`；`pending` / `on` / `off` |
| events.type / .status | `reading_camp` / `activity`；`draft` / `ongoing` / `finished` / `canceled` |
| event_signups.status | `signed` / `canceled` / `attended` |
| reports.status | `pending` / `processing` / `resolved` / `rejected` |
| moderation_logs.action | `machine` / `approve` / `reject` / `delete` / `warn` / `mute` / `ban` / `unban` / `appeal_pass` / `appeal_reject` |
| feedback.type / .status | `suggestion` / `bug` / `other`；`pending` / `processing` / `replied` / `closed` |

## 6. 核心索引对照（需求⑦）

| 需求要求 | 落地索引 |
| --- | --- |
| reading_sessions(user_id, start_time) | `idx_user_start (user_id, start_time)`，另有 `idx_start_time`、`idx_book_id` |
| reviews(book_id, created_at) | `idx_book_created (book_id, created_at)` |
| posts(created_at) | `idx_created_at`，另有话题/审核/用户索引 |
| books ISBN 唯一索引 | `uk_isbn`（可空，第三方无 ISBN 书允许 NULL） |
| orders(order_no) 唯一索引 | `uk_order_no` |
| 补充：分享防枚举 | books/reviews/booklists/posts 各有 `uk_short_code` |
| 补充：书架三态 | `uk_user_book (user_id, book_id)` + `idx_user_status` |
| 补充：搜索 | books 上 `FULLTEXT(title, subtitle, author) WITH PARSER ngram` |
| 补充：通知收件箱 | `idx_user_read (user_id, is_read, created_at)` |
| 补充：榜单 | `idx_status_rating`（高分）、`idx_status_shelf`（热门）、`idx_status_published`（新书） |

## 7. 种子数据与演示账号

**管理端**

| 账号 | 密码 | 角色 |
| --- | --- | --- |
| `admin` | `admin123` | 超级管理员（生产环境必须修改） |

**用户端（短信验证码登录，user_auths 不存密码；联调时验证码由后端测试通道下发/绕过）**

| 手机号 | 昵称 | 身份 |
| --- | --- | --- |
| 13800000001 | 林知秋 | 年卡会员（微信支付订单 + 支付流水） |
| 13800000002 | 沈砚书 | 7 天试用中（4 天后到期，用于到期提醒场景） |
| 13800000003 | 苏晚 | 月卡会员（兑换码 VIP-MONTH-BBBB 开通） |

**演示数据量**：21 个分类、14 个标签、8 枚徽章、2 个套餐、4 个角色、12 本已上架图书、12 条书架、33 个阅读场次（近 35 天，含 1 个进行中）、4 个阅读目标、8 条书评、2 个书单 7 个条目、6 条动态、8 条评论、12 条点赞/收藏、5 个话题、3 个 Banner、3 个每周好书/专栏、1 个共读营 + 3 个报名、2 笔订单 + 3 条订阅 + 1 条支付流水、3 个兑换码、6 条通知、2 条反馈、1 条举报、2 条审核日志、2 条操作日志。

## 8. 后续注意

- 字段级调整先同步本文件与《功能需求.md》⑦，再改 DDL（AGENTS.md 约定②）。
- 二期启用私信/关注时，conversations / messages / follows 已就位，无需变更结构。
- 热榜（高分/热门/新书）查询走索引 + Redis 缓存，不在表内做额外排序字段。
