-- =====================================================================
-- 时脉书社-阅读世界 · 基础字典数据（P0-03）
-- 内容：图书分类 / 标签 / 徽章 / 会员套餐 / 管理角色 / 超级管理员
-- 幂等：固定主键 + ON DUPLICATE KEY UPDATE（VALUES() 写法，MySQL 8.0 全版本兼容），
--       可重复执行；重复执行会以本文件内容为准刷新字典
-- 默认超管：admin / admin123（bcrypt cost=10，请在生产环境立即修改）
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 1. 图书分类（两级：6 个一级 + 15 个二级）
-- ---------------------------------------------------------------------
INSERT INTO categories (id, parent_id, name, icon_url, sort, book_count, status) VALUES
  (1,  0, '文学小说', '', 10, 0, 'enabled'),
  (2,  0, '人文历史', '', 20, 0, 'enabled'),
  (3,  0, '社科心理', '', 30, 0, 'enabled'),
  (4,  0, '科技商业', '', 40, 0, 'enabled'),
  (5,  0, '艺术生活', '', 50, 0, 'enabled'),
  (6,  0, '童书绘本', '', 60, 0, 'enabled'),
  (7,  1, '中国文学', '', 11, 0, 'enabled'),
  (8,  1, '外国文学', '', 12, 0, 'enabled'),
  (9,  1, '诗歌散文', '', 13, 0, 'enabled'),
  (10, 2, '历史',     '', 21, 0, 'enabled'),
  (11, 2, '哲学宗教', '', 22, 0, 'enabled'),
  (12, 2, '人物传记', '', 23, 0, 'enabled'),
  (13, 3, '社会学',   '', 31, 0, 'enabled'),
  (14, 3, '心理学',   '', 32, 0, 'enabled'),
  (15, 4, '科学新知', '', 41, 0, 'enabled'),
  (16, 4, '商业管理', '', 42, 0, 'enabled'),
  (17, 4, '计算机',   '', 43, 0, 'enabled'),
  (18, 5, '艺术设计', '', 51, 0, 'enabled'),
  (19, 5, '生活方式', '', 52, 0, 'enabled'),
  (20, 6, '儿童文学', '', 61, 0, 'enabled'),
  (21, 6, '绘本',     '', 62, 0, 'enabled')
ON DUPLICATE KEY UPDATE
  parent_id = VALUES(parent_id),
  name = VALUES(name),
  icon_url = VALUES(icon_url),
  sort = VALUES(sort),
  status = VALUES(status);

-- ---------------------------------------------------------------------
-- 2. 标签
-- ---------------------------------------------------------------------
INSERT INTO tags (id, name, use_count, status) VALUES
  (1,  '经典名著', 0, 'on'),
  (2,  '治愈温暖', 0, 'on'),
  (3,  '悬疑推理', 0, 'on'),
  (4,  '成长',     0, 'on'),
  (5,  '哲学思辨', 0, 'on'),
  (6,  '人物传记', 0, 'on'),
  (7,  '科幻',     0, 'on'),
  (8,  '散文随笔', 0, 'on'),
  (9,  '投资理财', 0, 'on'),
  (10, '认知思维', 0, 'on'),
  (11, '历史',     0, 'on'),
  (12, '长篇小说', 0, 'on'),
  (13, '短篇小说', 0, 'on'),
  (14, '女性',     0, 'on')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  use_count = VALUES(use_count),
  status = VALUES(status);

-- ---------------------------------------------------------------------
-- 3. 徽章
-- ---------------------------------------------------------------------
INSERT INTO badges (id, code, name, description, icon_url, category, rule_type, rule_value, rule_config, sort, status) VALUES
  (1, 'first_read',  '初次脉动',   '完成第一次阅读计时',          '', 'special', 'manual', NULL, NULL, 10, 'on'),
  (2, 'streak_7',    '七日连脉',   '连续 7 天完成阅读打卡',       '', 'streak',  'streak', 7,    NULL, 20, 'on'),
  (3, 'streak_30',   '月度坚持',   '连续 30 天完成阅读打卡',      '', 'streak',  'streak', 30,   NULL, 30, 'on'),
  (4, 'streak_100',  '百日不辍',   '连续 100 天完成阅读打卡',     '', 'streak',  'streak', 100,  NULL, 40, 'on'),
  (5, 'books_10',    '读书十册',   '累计读完 10 本书',            '', 'goal',    'books',  10,   NULL, 50, 'on'),
  (6, 'books_50',    '半百书卷',   '累计读完 50 本书',            '', 'goal',    'books',  50,   NULL, 60, 'on'),
  (7, 'review_10',   '书评达人',   '累计发布 10 条通过审核的书评', '', 'social',  'review', 10,   NULL, 70, 'on'),
  (8, 'goal_annual', '年度圆满',   '达成年度阅读目标',            '', 'goal',    'goal',   1,    JSON_OBJECT('scope', 'yearly'), 80, 'on')
ON DUPLICATE KEY UPDATE
  code = VALUES(code),
  name = VALUES(name),
  description = VALUES(description),
  icon_url = VALUES(icon_url),
  category = VALUES(category),
  rule_type = VALUES(rule_type),
  rule_value = VALUES(rule_value),
  rule_config = VALUES(rule_config),
  sort = VALUES(sort),
  status = VALUES(status);

-- ---------------------------------------------------------------------
-- 4. 会员套餐（月卡 ¥30 / 年卡 ¥288，金额单位：分）
-- ---------------------------------------------------------------------
INSERT INTO membership_plans
  (id, code, name, description, price_fen, original_price_fen, duration_days, benefits, sort, status)
VALUES
  (1, 'monthly', '月卡会员', '按月订阅，随时取消', 3000, 3000, 30,
   JSON_ARRAY('深度时脉报告与数据导出', '专属身份标识与装扮', '会员专属共读营/活动', '免广告与会员专享内容'),
   10, 'on'),
  (2, 'yearly', '年卡会员', '按年订阅，折合每月 ¥24，省 20%', 28800, 36000, 365,
   JSON_ARRAY('深度时脉报告与数据导出', '专属身份标识与装扮', '会员专属共读营/活动', '免广告与会员专享内容', '年度阅读盘点特别版'),
   20, 'on')
ON DUPLICATE KEY UPDATE
  code = VALUES(code),
  name = VALUES(name),
  description = VALUES(description),
  price_fen = VALUES(price_fen),
  original_price_fen = VALUES(original_price_fen),
  duration_days = VALUES(duration_days),
  benefits = VALUES(benefits),
  sort = VALUES(sort),
  status = VALUES(status);

-- 参考兑换码（用于验收一次性核销：首次兑换成功，再次使用/他人使用报错）
INSERT INTO redeem_codes
  (code, batch_no, plan_id, duration_days, status, expires_at)
VALUES
  ('MEMBER730', 'REF', 1, 30, 'unused', DATE_ADD(NOW(), INTERVAL 1 YEAR))
ON DUPLICATE KEY UPDATE
  code = VALUES(code);

-- ---------------------------------------------------------------------
-- 5. 管理角色（权限点：模块:动作，* 为全部）
-- ---------------------------------------------------------------------
INSERT INTO roles (id, code, name, description, permissions, is_builtin, status) VALUES
  (1, 'super_admin',      '超级管理员', '全部权限 + 财务 + 权限分配',
   JSON_ARRAY('*'), 1, 'active'),
  (2, 'content_ops',      '内容运营',   '建书、审核、举报处理、运营位与活动管理',
   JSON_ARRAY('book:*', 'category:*', 'tag:*', 'review:audit', 'post:audit',
              'comment:audit', 'report:*', 'banner:*', 'topic:*', 'column:*', 'event:*'),
   1, 'active'),
  (3, 'finance',          '财务运营',   '订单、流水、兑换码与会员管理',
   JSON_ARRAY('order:*', 'payment:*', 'redeem:*', 'member:*'),
   1, 'active'),
  (4, 'customer_service', '客服',       '反馈处理、举报查看与用户查询',
   JSON_ARRAY('feedback:*', 'report:read', 'report:handle', 'user:read'),
   1, 'active')
ON DUPLICATE KEY UPDATE
  code = VALUES(code),
  name = VALUES(name),
  description = VALUES(description),
  permissions = VALUES(permissions),
  is_builtin = VALUES(is_builtin),
  status = VALUES(status);

-- ---------------------------------------------------------------------
-- 6. 超级管理员：admin / admin123（bcrypt hash）
-- ---------------------------------------------------------------------
INSERT INTO admins (id, username, password_hash, name, avatar_url, status)
VALUES (1, 'admin', '$2a$10$QZkI4Nb7OLnnFzZki980YuszPuloRR1WcVVmv2dtXz7AG9tj8Rtza', '超级管理员', '', 'active')
ON DUPLICATE KEY UPDATE
  username = VALUES(username),
  password_hash = VALUES(password_hash),
  name = VALUES(name),
  avatar_url = VALUES(avatar_url),
  status = VALUES(status);

INSERT INTO admin_roles (id, admin_id, role_id)
VALUES (1, 1, 1)
ON DUPLICATE KEY UPDATE
  admin_id = VALUES(admin_id),
  role_id = VALUES(role_id);
