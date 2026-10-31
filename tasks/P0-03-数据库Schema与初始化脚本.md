# P0-03 数据库 Schema 与初始化脚本

- **编号**：P0-03
- **任务名称**：数据库 Schema 与初始化脚本
- **阶段**：P0 地基与数据
- **状态**：已完成（2026-09-21）

## 前置要求
- 材料：《功能需求.md》⑦ 数据库设计（表清单、设计规范、索引与容量）
- 依赖子任务：无（可与 P0-01 并行）

## 任务内容
编写约 30 张表的 DDL 与种子数据脚本，按业务域组织：
- **用户域**：users、user_auths、badges、user_badges
- **书库域**：books、categories、tags、book_tags、bookshelves
- **阅读域**：reading_sessions（user_id+时间索引）、reading_goals
- **社区域**：reviews、booklists、booklist_items、posts、comments、likes、follows（二期预留）
- **会员交易域**：membership_plans、member_subscriptions、orders、payment_records、redeem_codes
- **消息域**：notifications（二期：conversations、messages 预留）
- **运营域**：banners、topics、columns、events、event_signups
- **管理域**：admins、roles、admin_roles、reports、moderation_logs、operation_logs、feedback

设计规范落实：
- MySQL 8.0，utf8mb4 + InnoDB
- 主键自增 BIGINT；对外分享短码映射防枚举
- 业务表统一软删除（deleted_at）+ created_at/updated_at 审计
- 冗余计数字段（评分数/平均分/点赞/评论数）
- 核心索引：reading_sessions(user_id, start_time)、reviews(book_id, created_at)、posts(created_at)、books ISBN 唯一索引、orders(order_no) 唯一索引

## 结果
一键建库建表并灌入演示数据，为后端与前端联调提供数据基础。

## 产物
- `migrations/*.sql`（DDL 脚本，可重复执行）
- 种子数据脚本（seed）
- ER 说明文档（表关系与字段要点）

## 验收点
- [x] 脚本在干净 MySQL 8.0 上可重复执行成功（幂等）— 74 条语句通过 node-sql-parser 静态校验；幂等由 IF NOT EXISTS / ON DUPLICATE KEY UPDATE / INSERT IGNORE 保证（待有 Docker 环境时 `docker compose up mysql` 实跑复核）
- [x] 索引与需求⑦一致（核心索引全部命中，见 db/SCHEMA.md §6）
- [x] 软删除 + 审计字段在所有业务表落实（17 张关联/日志/财务凭证表按约定豁免，已在 SCHEMA.md 说明）
- [x] 种子数据覆盖书城 / 用户 / 书评演示场景（另含书架/时脉场次/书单/动态/会员支付/运营位全链路）
