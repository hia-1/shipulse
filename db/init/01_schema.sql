-- =====================================================================
-- 时脉书社-阅读世界 · 数据库 Schema（P0-03）
-- MySQL 8.0 / InnoDB / utf8mb4_unicode_ci
-- 幂等：全部使用 CREATE TABLE IF NOT EXISTS，可重复执行
-- 表顺序按外键依赖排列；多态关联（comments/likes/reports 等的 target）
-- 不建物理外键，仅建索引，由应用层保证一致性
-- 规范：BIGINT UNSIGNED 自增主键；业务表软删除 deleted_at + created_at/updated_at；
--      纯关联表仅 created_at；日志/流水类为只追加表（无 updated_at/deleted_at）
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================================
-- 一、用户域：users / user_auths / badges / user_badges
-- =====================================================================

-- 用户表（手机号为三端统一标识；注销走合规物理清除）
CREATE TABLE IF NOT EXISTS users (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  phone           VARCHAR(20)     NULL DEFAULT NULL COMMENT '手机号（统一标识，唯一）',
  nickname        VARCHAR(64)     NOT NULL DEFAULT '' COMMENT '昵称',
  avatar_url      VARCHAR(512)    NOT NULL DEFAULT '' COMMENT '头像URL',
  gender          TINYINT         NOT NULL DEFAULT 0 COMMENT '性别：0未知 1男 2女',
  bio             VARCHAR(200)    NOT NULL DEFAULT '' COMMENT '个人简介',
  status          VARCHAR(16)     NOT NULL DEFAULT 'active' COMMENT '状态：active正常 muted禁言 banned封禁 canceled已注销',
  muted_until     DATETIME        NULL DEFAULT NULL COMMENT '禁言到期时间（status=muted 时有效；到期自动恢复）',
  token_version   INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '令牌版本：封禁/改密/登出时+1，使已签发令牌立即失效',
  is_member       TINYINT         NOT NULL DEFAULT 0 COMMENT '是否会员：0否 1是（冗余，以订阅表为准）',
  member_expire_at DATETIME       NULL DEFAULT NULL COMMENT '会员到期时间（冗余）',
  book_count      INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '书架藏书数（冗余）',
  review_count    INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '书评数（冗余）',
  post_count      INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '动态数（冗余）',
  follower_count  INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '粉丝数（冗余，二期）',
  following_count INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '关注数（冗余，二期）',
  last_login_at   DATETIME        NULL DEFAULT NULL COMMENT '最后登录时间',
  created_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  deleted_at      DATETIME(3)     NULL DEFAULT NULL COMMENT '软删除时间；注销合规场景物理清除',
  PRIMARY KEY (id),
  UNIQUE KEY uk_phone (phone),
  KEY idx_status (status),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 账号授权表（手机验证码 / 微信扫码 / 小程序 openid，可多端绑定同一用户）
CREATE TABLE IF NOT EXISTS user_auths (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '授权ID',
  user_id       BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  identity_type VARCHAR(20)     NOT NULL COMMENT '类型：phone手机 wechat_web微信扫码 wechat_mp小程序',
  identifier    VARCHAR(128)    NOT NULL COMMENT '账号标识：手机号 / openid',
  credential    VARCHAR(255)    NOT NULL DEFAULT '' COMMENT '凭证哈希（预留；主登录走短信验证码与微信）',
  unionid       VARCHAR(64)     NULL DEFAULT NULL COMMENT '微信开放平台 unionid（三端打通）',
  verified      TINYINT         NOT NULL DEFAULT 0 COMMENT '是否已验证：0否 1是',
  last_used_at  DATETIME        NULL DEFAULT NULL COMMENT '最近使用时间',
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_type_identifier (identity_type, identifier),
  KEY idx_user_id (user_id),
  KEY idx_unionid (unionid),
  CONSTRAINT fk_user_auths_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户账号授权表';

-- 徽章定义表
CREATE TABLE IF NOT EXISTS badges (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '徽章ID',
  code        VARCHAR(64)     NOT NULL COMMENT '徽章编码（唯一）',
  name        VARCHAR(64)     NOT NULL COMMENT '徽章名称',
  description VARCHAR(255)    NOT NULL DEFAULT '' COMMENT '徽章描述',
  icon_url    VARCHAR(512)    NOT NULL DEFAULT '' COMMENT '徽章图标URL',
  category    VARCHAR(32)     NOT NULL DEFAULT 'special' COMMENT '分类：streak连续阅读 goal目标 social社交 special特殊',
  rule_type   VARCHAR(32)     NOT NULL DEFAULT 'manual' COMMENT '规则类型：streak连续天数 books累计书评量 goal目标达成 manual手动颁发',
  rule_value  INT UNSIGNED    NULL DEFAULT NULL COMMENT '规则阈值（如连续7天）',
  rule_config JSON            NULL COMMENT '扩展规则配置',
  sort        INT             NOT NULL DEFAULT 0 COMMENT '排序',
  status      VARCHAR(16)     NOT NULL DEFAULT 'on' COMMENT '状态：on启用 off停用',
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  deleted_at  DATETIME(3)     NULL DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='徽章定义表';

-- 用户徽章关联表
CREATE TABLE IF NOT EXISTS user_badges (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID',
  user_id     BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  badge_id    BIGINT UNSIGNED NOT NULL COMMENT '徽章ID',
  unlocked_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '解锁时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_badge (user_id, badge_id),
  KEY idx_badge_id (badge_id),
  CONSTRAINT fk_user_badges_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_user_badges_badge FOREIGN KEY (badge_id) REFERENCES badges (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户徽章关联表';

-- =====================================================================
-- 二、书库域：categories / tags / books / book_tags / bookshelves
-- =====================================================================

-- 图书分类表（两级树，parent_id=0 为一级）
CREATE TABLE IF NOT EXISTS categories (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '分类ID',
  parent_id  BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '父分类ID，0为一级',
  name       VARCHAR(64)     NOT NULL COMMENT '分类名称',
  icon_url   VARCHAR(512)    NOT NULL DEFAULT '' COMMENT '分类图标URL',
  sort       INT             NOT NULL DEFAULT 0 COMMENT '排序',
  book_count INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '分类下图书数（冗余）',
  status     VARCHAR(16)     NOT NULL DEFAULT 'enabled' COMMENT '状态：enabled启用 disabled停用',
  created_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  deleted_at DATETIME(3)     NULL DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_parent_name (parent_id, name),
  KEY idx_parent_sort (parent_id, sort)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图书分类表';

-- 标签表
CREATE TABLE IF NOT EXISTS tags (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '标签ID',
  name       VARCHAR(64)     NOT NULL COMMENT '标签名',
  use_count  INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '被引用次数（冗余）',
  status     VARCHAR(16)     NOT NULL DEFAULT 'on' COMMENT '状态：on启用 off停用',
  created_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  deleted_at DATETIME(3)     NULL DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图书标签表';

-- 图书表
CREATE TABLE IF NOT EXISTS books (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '图书ID',
  isbn           VARCHAR(20)     NULL DEFAULT NULL COMMENT 'ISBN-13（第三方导入；无ISBN书可空）',
  title          VARCHAR(255)    NOT NULL COMMENT '书名',
  subtitle       VARCHAR(255)    NOT NULL DEFAULT '' COMMENT '副标题',
  author         VARCHAR(255)    NOT NULL DEFAULT '' COMMENT '作者（多作者逗号分隔）',
  translator     VARCHAR(255)    NOT NULL DEFAULT '' COMMENT '译者',
  publisher      VARCHAR(128)    NOT NULL DEFAULT '' COMMENT '出版社',
  published_date VARCHAR(20)     NOT NULL DEFAULT '' COMMENT '出版日期/年月',
  pages          INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '总页数',
  cover_url      VARCHAR(512)    NOT NULL DEFAULT '' COMMENT '封面URL',
  description    TEXT            NULL COMMENT '内容简介',
  category_id    BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '主分类ID',
  rating_avg     DECIMAL(3,2)    UNSIGNED NOT NULL DEFAULT 0.00 COMMENT '平均评分0.00-5.00（支持半星，冗余）',
  rating_count   INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '评分人数（冗余）',
  review_count   INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '书评数（冗余）',
  shelf_count    INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '加书架总人数（冗余）',
  want_count     INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '想读人数（冗余）',
  reading_count  INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '在读人数（冗余）',
  finished_count INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '已读人数（冗余）',
  short_code     VARCHAR(16)     NULL DEFAULT NULL COMMENT '对外分享短码（防枚举）',
  status         VARCHAR(16)     NOT NULL DEFAULT 'pending' COMMENT '状态：pending待上架 on_shelf已上架 off_shelf已下架',
  source         VARCHAR(16)     NOT NULL DEFAULT 'manual' COMMENT '来源：manual手动录入 isbn第三方拉取',
  created_by     BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '创建管理员ID',
  published_at   DATETIME        NULL DEFAULT NULL COMMENT '上架时间',
  created_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  deleted_at     DATETIME(3)     NULL DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_isbn (isbn),
  UNIQUE KEY uk_short_code (short_code),
  KEY idx_category_status (category_id, status),
  KEY idx_status_published (status, published_at),
  KEY idx_status_rating (status, rating_avg),
  KEY idx_status_shelf (status, shelf_count),
  FULLTEXT KEY ft_title_author (title, subtitle, author) WITH PARSER ngram,
  CONSTRAINT fk_books_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
  CONSTRAINT fk_books_admin FOREIGN KEY (created_by) REFERENCES admins (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图书表';

-- 图书-标签关联表
CREATE TABLE IF NOT EXISTS book_tags (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID',
  book_id    BIGINT UNSIGNED NOT NULL COMMENT '图书ID',
  tag_id     BIGINT UNSIGNED NOT NULL COMMENT '标签ID',
  created_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_book_tag (book_id, tag_id),
  KEY idx_tag_id (tag_id),
  CONSTRAINT fk_book_tags_book FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE,
  CONSTRAINT fk_book_tags_tag FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图书标签关联表';

-- 个人书架表（想读/在读/已读三态）
CREATE TABLE IF NOT EXISTS bookshelves (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '书架ID',
  user_id      BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  book_id      BIGINT UNSIGNED NOT NULL COMMENT '图书ID',
  status       VARCHAR(16)     NOT NULL DEFAULT 'want' COMMENT '状态：want想读 reading在读 read已读',
  current_page INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '当前页码',
  progress     TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '阅读进度百分比0-100',
  last_read_at DATETIME        NULL DEFAULT NULL COMMENT '最近阅读时间',
  created_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  deleted_at   DATETIME(3)     NULL DEFAULT NULL COMMENT '软删除时间（移出书架）',
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_book (user_id, book_id),
  KEY idx_user_status (user_id, status),
  KEY idx_book_id (book_id),
  KEY idx_last_read (user_id, last_read_at),
  CONSTRAINT fk_bookshelves_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_bookshelves_book FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='个人书架表';

-- =====================================================================
-- 三、阅读域：reading_sessions / reading_goals
-- =====================================================================

-- 阅读场次表（手动开始/结束计时，时脉报告数据源）
CREATE TABLE IF NOT EXISTS reading_sessions (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '场次ID',
  user_id          BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  book_id          BIGINT UNSIGNED NOT NULL COMMENT '图书ID',
  bookshelf_id     BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '书架记录ID',
  start_time       DATETIME        NOT NULL COMMENT '开始时间',
  end_time         DATETIME        NULL DEFAULT NULL COMMENT '结束时间（进行中为空）',
  duration_seconds INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '阅读时长（秒）',
  start_page       INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '起始页码',
  end_page         INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '结束页码',
  note             VARCHAR(1000)   NOT NULL DEFAULT '' COMMENT '笔记摘抄',
  source           VARCHAR(16)     NOT NULL DEFAULT 'web' COMMENT '来源：web网站 miniprogram小程序',
  status           VARCHAR(16)     NOT NULL DEFAULT 'ongoing' COMMENT '状态：ongoing进行中 finished已结束',
  created_at       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  deleted_at       DATETIME(3)     NULL DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (id),
  KEY idx_user_start (user_id, start_time),
  KEY idx_start_time (start_time),
  KEY idx_book_id (book_id),
  KEY idx_status (status),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_sessions_book FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE,
  CONSTRAINT fk_sessions_shelf FOREIGN KEY (bookshelf_id) REFERENCES bookshelves (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='阅读场次表';

-- 阅读目标表（年度/月度）
CREATE TABLE IF NOT EXISTS reading_goals (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '目标ID',
  user_id        BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  goal_type      VARCHAR(16)     NOT NULL COMMENT '类型：yearly年度 monthly月度',
  period         VARCHAR(10)     NOT NULL COMMENT '周期：2026 或 2026-09',
  target_minutes INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '目标时长（分钟）',
  target_books   INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '目标读完本数',
  actual_minutes INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '实际时长（分钟，冗余汇总）',
  actual_books   INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '实际读完本数（冗余汇总）',
  status         VARCHAR(16)     NOT NULL DEFAULT 'active' COMMENT '状态：active进行中 achieved已达成 archived归档',
  created_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  deleted_at     DATETIME(3)     NULL DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_type_period (user_id, goal_type, period),
  CONSTRAINT fk_goals_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='阅读目标表';

-- =====================================================================
-- 四、社区域：reviews / booklists / booklist_items / posts /
--           comments / likes / follows（二期预留）
-- =====================================================================

-- 书评表（五星半星制 + 机审状态机）
CREATE TABLE IF NOT EXISTS reviews (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '书评ID',
  short_code    VARCHAR(16)     NULL DEFAULT NULL COMMENT '对外分享短码',
  user_id       BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  book_id       BIGINT UNSIGNED NOT NULL COMMENT '图书ID',
  rating        DECIMAL(2,1)    UNSIGNED NOT NULL COMMENT '评分：0.5-5.0（半星步进）',
  title         VARCHAR(255)    NOT NULL DEFAULT '' COMMENT '书评标题',
  content       MEDIUMTEXT      NULL COMMENT '书评正文',
  like_count    INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '点赞数（冗余）',
  comment_count INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '评论数（冗余）',
  audit_status  VARCHAR(16)     NOT NULL DEFAULT 'pending' COMMENT '审核：pending机审中 approved通过 rejected驳回',
  audit_reason  VARCHAR(255)    NOT NULL DEFAULT '' COMMENT '驳回/可疑原因',
  machine_score INT             NULL DEFAULT NULL COMMENT '机审风险分（0-100）',
  is_featured   TINYINT         NOT NULL DEFAULT 0 COMMENT '是否官方精选：0否 1是',
  published_at  DATETIME        NULL DEFAULT NULL COMMENT '发布时间',
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  deleted_at    DATETIME(3)     NULL DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_short_code (short_code),
  KEY idx_book_created (book_id, created_at),
  KEY idx_user_id (user_id),
  KEY idx_audit_published (audit_status, published_at),
  KEY idx_featured (is_featured, published_at),
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_book FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='书评表';

-- 书单表
CREATE TABLE IF NOT EXISTS booklists (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '书单ID',
  short_code    VARCHAR(16)     NULL DEFAULT NULL COMMENT '对外分享短码',
  user_id       BIGINT UNSIGNED NOT NULL COMMENT '创建者用户ID',
  title         VARCHAR(128)    NOT NULL COMMENT '书单标题',
  description   VARCHAR(1000)   NOT NULL DEFAULT '' COMMENT '书单简介',
  cover_url     VARCHAR(512)    NOT NULL DEFAULT '' COMMENT '书单封面URL',
  item_count    INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '收录图书数（冗余）',
  collect_count INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '收藏数（冗余）',
  like_count    INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '点赞数（冗余）',
  audit_status  VARCHAR(16)     NOT NULL DEFAULT 'pending' COMMENT '审核：pending/approved/rejected',
  audit_reason  VARCHAR(255)    NOT NULL DEFAULT '' COMMENT '驳回/可疑原因',
  machine_score INT             NULL DEFAULT NULL COMMENT '机审风险分（0-100）',
  is_official   TINYINT         NOT NULL DEFAULT 0 COMMENT '是否官方书单：0否 1是',
  published_at  DATETIME        NULL DEFAULT NULL COMMENT '发布时间',
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  deleted_at    DATETIME(3)     NULL DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_short_code (short_code),
  KEY idx_user_id (user_id),
  KEY idx_audit_published (audit_status, published_at),
  KEY idx_collect (collect_count),
  CONSTRAINT fk_booklists_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='书单表';

-- 书单条目表
CREATE TABLE IF NOT EXISTS booklist_items (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID',
  booklist_id BIGINT UNSIGNED NOT NULL COMMENT '书单ID',
  book_id     BIGINT UNSIGNED NOT NULL COMMENT '图书ID',
  sort        INT             NOT NULL DEFAULT 0 COMMENT '排序',
  note        VARCHAR(255)    NOT NULL DEFAULT '' COMMENT '推荐语',
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_list_book (booklist_id, book_id),
  KEY idx_book_id (book_id),
  CONSTRAINT fk_bl_items_list FOREIGN KEY (booklist_id) REFERENCES booklists (id) ON DELETE CASCADE,
  CONSTRAINT fk_bl_items_book FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='书单条目表';

-- 动态表（阅读打卡 / 图文动态）
CREATE TABLE IF NOT EXISTS posts (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '动态ID',
  short_code   VARCHAR(16)     NULL DEFAULT NULL COMMENT '对外分享短码',
  user_id      BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  type         VARCHAR(16)     NOT NULL DEFAULT 'checkin' COMMENT '类型：checkin阅读打卡 text图文动态',
  book_id      BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '关联图书ID（打卡）',
  topic_id     BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '话题ID',
  content      VARCHAR(2000)   NOT NULL DEFAULT '' COMMENT '正文',
  images       JSON            NULL COMMENT '图片URL数组',
  location     VARCHAR(128)    NOT NULL DEFAULT '' COMMENT '定位',
  read_minutes INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '本次打卡阅读时长（分钟）',
  like_count   INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '点赞数（冗余）',
  comment_count INT UNSIGNED   NOT NULL DEFAULT 0 COMMENT '评论数（冗余）',
  audit_status VARCHAR(16)     NOT NULL DEFAULT 'pending' COMMENT '审核：pending/approved/rejected',
  machine_score INT            NULL DEFAULT NULL COMMENT '机审风险分（0-100）',
  audit_reason VARCHAR(255)    NOT NULL DEFAULT '' COMMENT '审核驳回原因',
  published_at DATETIME        NULL DEFAULT NULL COMMENT '发布时间',
  created_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  deleted_at   DATETIME(3)     NULL DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_short_code (short_code),
  KEY idx_created_at (created_at),
  KEY idx_user_id (user_id),
  KEY idx_topic_created (topic_id, created_at),
  KEY idx_book_id (book_id),
  KEY idx_audit_published (audit_status, published_at),
  CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_posts_book FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE SET NULL,
  CONSTRAINT fk_posts_topic FOREIGN KEY (topic_id) REFERENCES topics (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='动态表';

-- 评论表（多态：书评/动态/书单；两级回复）
CREATE TABLE IF NOT EXISTS comments (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '评论ID',
  user_id      BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  target_type  VARCHAR(16)     NOT NULL COMMENT '对象类型：review/post/booklist',
  target_id    BIGINT UNSIGNED NOT NULL COMMENT '对象ID',
  parent_id    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '父评论ID，0为一级评论',
  reply_to_uid BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '被回复用户ID',
  content      VARCHAR(1000)   NOT NULL COMMENT '评论内容',
  like_count   INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '点赞数（冗余）',
  audit_status VARCHAR(16)     NOT NULL DEFAULT 'approved' COMMENT '审核：pending/approved/rejected',
  created_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  deleted_at   DATETIME(3)     NULL DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (id),
  KEY idx_target (target_type, target_id, created_at),
  KEY idx_user_id (user_id),
  KEY idx_parent (parent_id),
  CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论表（多态）';

-- 点赞/收藏表（多态；interaction_type=collect 用于书单收藏）
CREATE TABLE IF NOT EXISTS likes (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID',
  user_id          BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  target_type      VARCHAR(16)     NOT NULL COMMENT '对象类型：review/post/comment/booklist',
  target_id        BIGINT UNSIGNED NOT NULL COMMENT '对象ID',
  interaction_type VARCHAR(10)     NOT NULL DEFAULT 'like' COMMENT '互动类型：like点赞 collect收藏',
  created_at       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_target (user_id, target_type, target_id, interaction_type),
  KEY idx_target (target_type, target_id, interaction_type),
  CONSTRAINT fk_likes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='点赞收藏表（多态）';

-- 关注关系表（二期预留）
CREATE TABLE IF NOT EXISTS follows (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID',
  follower_id BIGINT UNSIGNED NOT NULL COMMENT '粉丝用户ID',
  followee_id BIGINT UNSIGNED NOT NULL COMMENT '被关注用户ID',
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_follower_followee (follower_id, followee_id),
  KEY idx_followee (followee_id),
  CONSTRAINT fk_follows_follower FOREIGN KEY (follower_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_follows_followee FOREIGN KEY (followee_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='关注关系表（二期预留）';

-- =====================================================================
-- 五、会员交易域：membership_plans / orders / member_subscriptions /
--           payment_records / redeem_codes
-- =====================================================================

-- 会员套餐表
CREATE TABLE IF NOT EXISTS membership_plans (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '套餐ID',
  code                VARCHAR(32)     NOT NULL COMMENT '套餐编码：monthly月卡 yearly年卡',
  name                VARCHAR(64)     NOT NULL COMMENT '套餐名称',
  description         VARCHAR(500)    NOT NULL DEFAULT '' COMMENT '套餐说明',
  price_fen           INT UNSIGNED    NOT NULL COMMENT '现价（分）',
  original_price_fen  INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '原价（分），用于划线价',
  duration_days       INT UNSIGNED    NOT NULL COMMENT '会员时长（天）',
  benefits            JSON            NULL COMMENT '权益点列表',
  sort                INT             NOT NULL DEFAULT 0 COMMENT '排序',
  status              VARCHAR(16)     NOT NULL DEFAULT 'on' COMMENT '状态：on上架 off下架',
  created_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  deleted_at          DATETIME(3)     NULL DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会员套餐表';

-- 订单表（财务记录，不做软删除）
CREATE TABLE IF NOT EXISTS orders (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '订单ID',
  order_no     VARCHAR(32)     NOT NULL COMMENT '订单号（唯一）',
  user_id      BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  plan_id      BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '套餐ID',
  order_type   VARCHAR(16)     NOT NULL COMMENT '类型：subscription会员订阅 redeem兑换码',
  title        VARCHAR(128)    NOT NULL DEFAULT '' COMMENT '订单标题',
  amount_fen   INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '金额（分）',
  status       VARCHAR(16)     NOT NULL DEFAULT 'pending' COMMENT '状态：pending待支付 paid已支付 closed已关闭 refunded已退款',
  channel      VARCHAR(16)     NOT NULL DEFAULT 'wechat' COMMENT '支付渠道：wechat微信支付',
  paid_at      DATETIME        NULL DEFAULT NULL COMMENT '支付时间',
  closed_at    DATETIME        NULL DEFAULT NULL COMMENT '关闭时间',
  refunded_at  DATETIME        NULL DEFAULT NULL COMMENT '退款时间',
  refund_reason VARCHAR(255)   NOT NULL DEFAULT '' COMMENT '退款原因（人工例外）',
  remark       VARCHAR(255)    NOT NULL DEFAULT '' COMMENT '备注',
  created_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_order_no (order_no),
  KEY idx_user_status (user_id, status),
  KEY idx_status_created (status, created_at),
  KEY idx_paid_at (paid_at),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_orders_plan FOREIGN KEY (plan_id) REFERENCES membership_plans (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单表';

-- 会员订阅表（套餐+订阅+订单+支付流水四表模型）
CREATE TABLE IF NOT EXISTS member_subscriptions (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '订阅ID',
  user_id          BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  plan_id          BIGINT UNSIGNED NOT NULL COMMENT '套餐ID',
  order_id         BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '开通订单ID（试用/兑换为空）',
  start_time       DATETIME        NOT NULL COMMENT '开始时间',
  expire_time      DATETIME        NOT NULL COMMENT '到期时间',
  status           VARCHAR(16)     NOT NULL DEFAULT 'active' COMMENT '状态：trialing试用 active有效 expired已到期 canceled已取消',
  auto_renew       TINYINT         NOT NULL DEFAULT 0 COMMENT '是否自动续费：0否 1是',
  channel          VARCHAR(16)     NOT NULL DEFAULT 'wechat' COMMENT '开通渠道：wechat微信 redeem兑换码 trial试用',
  remind_7_sent    TINYINT         NOT NULL DEFAULT 0 COMMENT '到期前7天提醒已发',
  remind_3_sent    TINYINT         NOT NULL DEFAULT 0 COMMENT '到期前3天提醒已发',
  remind_1_sent    TINYINT         NOT NULL DEFAULT 0 COMMENT '到期前1天提醒已发',
  created_at       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  PRIMARY KEY (id),
  KEY idx_user_id (user_id),
  KEY idx_status_expire (status, expire_time),
  KEY idx_plan_id (plan_id),
  CONSTRAINT fk_subs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_subs_plan FOREIGN KEY (plan_id) REFERENCES membership_plans (id) ON DELETE CASCADE,
  CONSTRAINT fk_subs_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会员订阅表';

-- 支付流水表（只追加，对账依据）
CREATE TABLE IF NOT EXISTS payment_records (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '流水ID',
  order_id       BIGINT UNSIGNED NOT NULL COMMENT '订单ID',
  payment_no     VARCHAR(64)     NOT NULL DEFAULT '' COMMENT '商户支付单号',
  transaction_id VARCHAR(64)     NULL DEFAULT NULL COMMENT '微信支付交易号',
  channel        VARCHAR(16)     NOT NULL DEFAULT 'wechat' COMMENT '渠道：wechat',
  amount_fen     INT UNSIGNED    NOT NULL COMMENT '金额（分）',
  status         VARCHAR(16)     NOT NULL DEFAULT 'pending' COMMENT '状态：pending待支付 success成功 failed失败 refunded已退款',
  raw_callback   JSON            NULL COMMENT '回调原始报文',
  paid_at        DATETIME        NULL DEFAULT NULL COMMENT '支付成功时间',
  created_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_transaction_id (transaction_id),
  KEY idx_order_id (order_id),
  KEY idx_status_created (status, created_at),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='支付流水表';

-- 兑换码表
CREATE TABLE IF NOT EXISTS redeem_codes (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '兑换码ID',
  code          VARCHAR(32)     NOT NULL COMMENT '兑换码（唯一）',
  batch_no      VARCHAR(32)     NOT NULL DEFAULT '' COMMENT '批次号',
  plan_id       BIGINT UNSIGNED NOT NULL COMMENT '兑换套餐ID',
  duration_days INT UNSIGNED    NOT NULL COMMENT '兑换时长（天）',
  status        VARCHAR(16)     NOT NULL DEFAULT 'unused' COMMENT '状态：unused未使用 used已使用 disabled已停用 expired已过期',
  used_by       BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '使用者用户ID',
  used_at       DATETIME        NULL DEFAULT NULL COMMENT '使用时间',
  order_id      BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '关联订单ID',
  expires_at    DATETIME        NULL DEFAULT NULL COMMENT '兑换码失效时间',
  created_by    BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '生成管理员ID',
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_code (code),
  KEY idx_batch (batch_no),
  KEY idx_status (status),
  KEY idx_used_by (used_by),
  CONSTRAINT fk_redeem_plan FOREIGN KEY (plan_id) REFERENCES membership_plans (id) ON DELETE CASCADE,
  CONSTRAINT fk_redeem_user FOREIGN KEY (used_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_redeem_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE SET NULL,
  CONSTRAINT fk_redeem_admin FOREIGN KEY (created_by) REFERENCES admins (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='兑换码表';

-- =====================================================================
-- 六、消息域：notifications（一期单表）/ conversations / messages（二期预留）
-- =====================================================================

-- 站内通知表（类型字段区分点赞/评论/关注/系统等）
CREATE TABLE IF NOT EXISTS notifications (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '通知ID',
  user_id     BIGINT UNSIGNED NOT NULL COMMENT '接收用户ID',
  type        VARCHAR(20)     NOT NULL COMMENT '类型：like点赞 comment评论 follow关注 system系统 order订单 audit审核',
  title       VARCHAR(128)    NOT NULL DEFAULT '' COMMENT '标题',
  content     VARCHAR(500)    NOT NULL DEFAULT '' COMMENT '内容',
  sender_id   BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '触发者用户ID，0为系统',
  target_type VARCHAR(16)     NOT NULL DEFAULT '' COMMENT '跳转对象类型：review/post/booklist/order等',
  target_id   BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '跳转对象ID',
  is_read     TINYINT         NOT NULL DEFAULT 0 COMMENT '是否已读：0否 1是',
  read_at     DATETIME        NULL DEFAULT NULL COMMENT '阅读时间',
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  PRIMARY KEY (id),
  KEY idx_user_read (user_id, is_read, created_at),
  KEY idx_user_created (user_id, created_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='站内通知表';

-- 私信会话表（二期预留）
CREATE TABLE IF NOT EXISTS conversations (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '会话ID',
  user1_id        BIGINT UNSIGNED NOT NULL COMMENT '用户1ID（较小者）',
  user2_id        BIGINT UNSIGNED NOT NULL COMMENT '用户2ID（较大者）',
  last_message_at DATETIME        NULL DEFAULT NULL COMMENT '最后消息时间',
  created_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_pair (user1_id, user2_id),
  KEY idx_user2 (user2_id),
  CONSTRAINT fk_conv_user1 FOREIGN KEY (user1_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_conv_user2 FOREIGN KEY (user2_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='私信会话表（二期预留）';

-- 私信消息表（二期预留）
CREATE TABLE IF NOT EXISTS messages (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '消息ID',
  conversation_id BIGINT UNSIGNED NOT NULL COMMENT '会话ID',
  sender_id       BIGINT UNSIGNED NOT NULL COMMENT '发送者ID',
  content         VARCHAR(1000)   NOT NULL DEFAULT '' COMMENT '文本内容',
  type            VARCHAR(16)     NOT NULL DEFAULT 'text' COMMENT '类型：text文本 image图片',
  is_read         TINYINT         NOT NULL DEFAULT 0 COMMENT '是否已读',
  created_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  PRIMARY KEY (id),
  KEY idx_conversation (conversation_id, created_at),
  KEY idx_sender (sender_id),
  CONSTRAINT fk_messages_conv FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='私信消息表（二期预留）';

-- =====================================================================
-- 七、运营域：banners / topics / columns / events / event_signups
-- =====================================================================

-- Banner 运营位表
CREATE TABLE IF NOT EXISTS banners (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Banner ID',
  title      VARCHAR(128)    NOT NULL COMMENT '标题',
  image_url  VARCHAR(512)    NOT NULL COMMENT '图片URL',
  position   VARCHAR(32)     NOT NULL DEFAULT 'home_top' COMMENT '位置：home_top首页轮播 home_pop弹窗',
  link_type  VARCHAR(16)     NOT NULL DEFAULT 'none' COMMENT '跳转：none无 book图书 booklist书单 web外链',
  link_value VARCHAR(512)    NOT NULL DEFAULT '' COMMENT '跳转值（ID或URL）',
  sort       INT             NOT NULL DEFAULT 0 COMMENT '排序',
  start_time DATETIME        NULL DEFAULT NULL COMMENT '上线开始时间',
  end_time   DATETIME        NULL DEFAULT NULL COMMENT '上线结束时间',
  status     VARCHAR(16)     NOT NULL DEFAULT 'on' COMMENT '状态：on上线 off下线',
  created_by BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '创建管理员ID',
  created_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  deleted_at DATETIME(3)     NULL DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (id),
  KEY idx_position_status (position, status, sort),
  CONSTRAINT fk_banners_admin FOREIGN KEY (created_by) REFERENCES admins (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Banner运营位表';

-- 话题表
CREATE TABLE IF NOT EXISTS topics (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '话题ID',
  title       VARCHAR(128)    NOT NULL COMMENT '话题名称',
  description VARCHAR(500)    NOT NULL DEFAULT '' COMMENT '话题描述',
  cover_url   VARCHAR(512)    NOT NULL DEFAULT '' COMMENT '封面URL',
  post_count  INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '动态数（冗余）',
  sort        INT             NOT NULL DEFAULT 0 COMMENT '排序',
  status      VARCHAR(16)     NOT NULL DEFAULT 'on' COMMENT '状态：on上线 off下线',
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  deleted_at  DATETIME(3)     NULL DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (id),
  KEY idx_status_sort (status, sort)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='话题表';

-- 专栏/每周好书表
CREATE TABLE IF NOT EXISTS `columns` (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID',
  type         VARCHAR(16)     NOT NULL COMMENT '类型：weekly_pick每周好书 column编辑专栏',
  title        VARCHAR(128)    NOT NULL COMMENT '标题',
  subtitle     VARCHAR(255)    NOT NULL DEFAULT '' COMMENT '副标题/引言',
  book_id      BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '每周好书关联图书ID',
  cover_url    VARCHAR(512)    NOT NULL DEFAULT '' COMMENT '封面URL',
  content      MEDIUMTEXT      NULL COMMENT '专栏图文内容',
  sort         INT             NOT NULL DEFAULT 0 COMMENT '排序',
  status       VARCHAR(16)     NOT NULL DEFAULT 'pending' COMMENT '状态：pending待发布 on上线 off下线',
  published_at DATETIME        NULL DEFAULT NULL COMMENT '发布时间',
  created_by   BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '创建管理员ID',
  created_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  deleted_at   DATETIME(3)     NULL DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (id),
  KEY idx_type_status (type, status, published_at),
  CONSTRAINT fk_columns_book FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE SET NULL,
  CONSTRAINT fk_columns_admin FOREIGN KEY (created_by) REFERENCES admins (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='专栏/每周好书表';

-- 活动/共读营表
CREATE TABLE IF NOT EXISTS events (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '活动ID',
  title        VARCHAR(128)    NOT NULL COMMENT '活动标题',
  type         VARCHAR(16)     NOT NULL DEFAULT 'activity' COMMENT '类型：reading_camp共读营 activity活动',
  cover_url    VARCHAR(512)    NOT NULL DEFAULT '' COMMENT '封面URL',
  description  MEDIUMTEXT      NULL COMMENT '活动详情',
  start_time   DATETIME        NOT NULL COMMENT '活动开始时间',
  end_time     DATETIME        NOT NULL COMMENT '活动结束时间',
  signup_start DATETIME        NULL DEFAULT NULL COMMENT '报名开始时间',
  signup_end   DATETIME        NULL DEFAULT NULL COMMENT '报名结束时间',
  capacity     INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '名额，0为不限',
  signup_count INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '报名人数（冗余）',
  member_only  TINYINT         NOT NULL DEFAULT 0 COMMENT '是否会员专属：0否 1是',
  status       VARCHAR(16)     NOT NULL DEFAULT 'draft' COMMENT '状态：draft草稿 ongoing报名/进行中 finished已结束 canceled已取消',
  created_by   BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '创建管理员ID',
  created_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  deleted_at   DATETIME(3)     NULL DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (id),
  KEY idx_status_time (status, start_time),
  KEY idx_type (type),
  CONSTRAINT fk_events_admin FOREIGN KEY (created_by) REFERENCES admins (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='活动/共读营表';

-- 活动报名表
CREATE TABLE IF NOT EXISTS event_signups (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '报名ID',
  event_id    BIGINT UNSIGNED NOT NULL COMMENT '活动ID',
  user_id     BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  status      VARCHAR(16)     NOT NULL DEFAULT 'signed' COMMENT '状态：signed已报名 canceled已取消 attended已参加',
  signup_time DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '报名时间',
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_event_user (event_id, user_id),
  KEY idx_user_id (user_id),
  KEY idx_status (status),
  CONSTRAINT fk_signups_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
  CONSTRAINT fk_signups_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='活动报名表';

-- =====================================================================
-- 八、管理域：admins / roles / admin_roles / reports /
--           moderation_logs / operation_logs / feedback
-- =====================================================================

-- 管理员表
CREATE TABLE IF NOT EXISTS admins (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '管理员ID',
  username       VARCHAR(64)     NOT NULL COMMENT '登录名（唯一）',
  password_hash  VARCHAR(255)    NOT NULL COMMENT '密码哈希（bcrypt）',
  name           VARCHAR(64)     NOT NULL DEFAULT '' COMMENT '姓名/显示名',
  avatar_url     VARCHAR(512)    NOT NULL DEFAULT '' COMMENT '头像URL',
  status         VARCHAR(16)     NOT NULL DEFAULT 'active' COMMENT '状态：active启用 disabled停用',
  token_version  INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '令牌版本：改密/停用时+1，使已签发令牌立即失效',
  last_login_at  DATETIME        NULL DEFAULT NULL COMMENT '最后登录时间',
  last_login_ip  VARCHAR(45)     NOT NULL DEFAULT '' COMMENT '最后登录IP',
  created_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  deleted_at     DATETIME(3)     NULL DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理员表';

-- 管理角色表
CREATE TABLE IF NOT EXISTS roles (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '角色ID',
  code        VARCHAR(64)     NOT NULL COMMENT '角色编码（唯一）',
  name        VARCHAR(64)     NOT NULL COMMENT '角色名称',
  description VARCHAR(255)    NOT NULL DEFAULT '' COMMENT '角色描述',
  permissions JSON            NOT NULL COMMENT '权限点列表（如 ["book:create","review:audit"]）',
  is_builtin  TINYINT         NOT NULL DEFAULT 0 COMMENT '是否内置角色：0否 1是（不可删）',
  status      VARCHAR(16)     NOT NULL DEFAULT 'active' COMMENT '状态：active启用 disabled停用',
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  deleted_at  DATETIME(3)     NULL DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理角色表';

-- 管理员-角色关联表
CREATE TABLE IF NOT EXISTS admin_roles (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'ID',
  admin_id   BIGINT UNSIGNED NOT NULL COMMENT '管理员ID',
  role_id    BIGINT UNSIGNED NOT NULL COMMENT '角色ID',
  created_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_admin_role (admin_id, role_id),
  KEY idx_role_id (role_id),
  CONSTRAINT fk_admin_roles_admin FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE CASCADE,
  CONSTRAINT fk_admin_roles_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理员角色关联表';

-- 举报表
CREATE TABLE IF NOT EXISTS reports (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '举报ID',
  reporter_id   BIGINT UNSIGNED NOT NULL COMMENT '举报人ID',
  reporter_type VARCHAR(16)     NOT NULL DEFAULT 'user' COMMENT '举报人类型：user用户 admin管理员',
  target_type   VARCHAR(16)     NOT NULL COMMENT '被举报对象：review/post/comment/booklist/user',
  target_id     BIGINT UNSIGNED NOT NULL COMMENT '被举报对象ID',
  reason        VARCHAR(32)     NOT NULL COMMENT '举报理由码：porn/abuse/ad/spam/infringe/other',
  description   VARCHAR(500)    NOT NULL DEFAULT '' COMMENT '举报说明',
  images        JSON            NULL COMMENT '凭证图片URL数组',
  status        VARCHAR(16)     NOT NULL DEFAULT 'pending' COMMENT '状态：pending待处理 processing处理中 resolved已处理 rejected已驳回',
  handler_id    BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '处理管理员ID',
  handle_result VARCHAR(255)    NOT NULL DEFAULT '' COMMENT '处理结果',
  handled_at    DATETIME        NULL DEFAULT NULL COMMENT '处理时间',
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  deleted_at    DATETIME(3)     NULL DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (id),
  KEY idx_status_created (status, created_at),
  KEY idx_target (target_type, target_id),
  KEY idx_reporter (reporter_id),
  CONSTRAINT fk_reports_handler FOREIGN KEY (handler_id) REFERENCES admins (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='举报表';

-- 申诉表（用户对被处罚内容的申诉；管理员复核可改判）
CREATE TABLE IF NOT EXISTS appeals (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '申诉ID',
  user_id           BIGINT UNSIGNED NOT NULL COMMENT '申诉人ID',
  target_type       VARCHAR(16)     NOT NULL COMMENT '申诉对象：review/post/comment/booklist/user',
  target_id         BIGINT UNSIGNED NOT NULL COMMENT '对象ID',
  moderation_log_id BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '关联的处罚记录ID（moderation_logs.id）',
  reason            VARCHAR(500)    NOT NULL DEFAULT '' COMMENT '申诉理由',
  status            VARCHAR(16)     NOT NULL DEFAULT 'pending' COMMENT '状态：pending待复核 approved申诉通过 rejected申诉驳回',
  reviewer_id       BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '复核管理员ID',
  review_result     VARCHAR(255)    NOT NULL DEFAULT '' COMMENT '复核结论',
  reviewed_at       DATETIME        NULL DEFAULT NULL COMMENT '复核时间',
  created_at        DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at        DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  deleted_at        DATETIME(3)     NULL DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (id),
  KEY idx_status_created (status, created_at),
  KEY idx_target (target_type, target_id),
  KEY idx_user (user_id),
  CONSTRAINT fk_appeals_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_appeals_reviewer FOREIGN KEY (reviewer_id) REFERENCES admins (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='违规申诉表';

-- 内容审核/处罚日志表（只追加；机审与人工处置全留痕）
CREATE TABLE IF NOT EXISTS moderation_logs (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  target_type   VARCHAR(16)     NOT NULL COMMENT '对象类型：review/post/comment/booklist/user',
  target_id     BIGINT UNSIGNED NOT NULL COMMENT '对象ID',
  action        VARCHAR(24)     NOT NULL COMMENT '动作：machine机审 approve通过 reject驳回 delete删除 warn警告 mute禁言 ban封号 appeal_pass申诉通过 appeal_reject申诉驳回',
  reason        VARCHAR(255)    NOT NULL DEFAULT '' COMMENT '原因',
  operator_type VARCHAR(16)     NOT NULL DEFAULT 'system' COMMENT '操作者类型：machine机审 system系统 admin管理员',
  operator_id   BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '操作者ID（管理员；机审/系统为0）',
  detail        JSON            NULL COMMENT '扩展详情',
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  PRIMARY KEY (id),
  KEY idx_target (target_type, target_id),
  KEY idx_action_created (action, created_at),
  KEY idx_operator (operator_type, operator_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='内容审核处罚日志表';

-- 管理员操作日志表（只追加）
CREATE TABLE IF NOT EXISTS operation_logs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  admin_id    BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '管理员ID',
  username    VARCHAR(64)     NOT NULL DEFAULT '' COMMENT '操作时登录名（冗余）',
  module      VARCHAR(32)     NOT NULL DEFAULT '' COMMENT '业务模块',
  action      VARCHAR(64)     NOT NULL DEFAULT '' COMMENT '操作动作',
  method      VARCHAR(10)     NOT NULL DEFAULT '' COMMENT 'HTTP方法',
  path        VARCHAR(255)    NOT NULL DEFAULT '' COMMENT '请求路径',
  params      JSON            NULL COMMENT '请求参数（脱敏后）',
  ip          VARCHAR(45)     NOT NULL DEFAULT '' COMMENT 'IP',
  user_agent  VARCHAR(255)    NOT NULL DEFAULT '' COMMENT 'User-Agent',
  status_code INT             NOT NULL DEFAULT 0 COMMENT 'HTTP状态码',
  duration_ms INT             NOT NULL DEFAULT 0 COMMENT '耗时（毫秒）',
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  PRIMARY KEY (id),
  KEY idx_admin_created (admin_id, created_at),
  KEY idx_module_created (module, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理员操作日志表';

-- 意见反馈表
CREATE TABLE IF NOT EXISTS feedback (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '反馈ID',
  user_id    BIGINT UNSIGNED NOT NULL COMMENT '提交用户ID',
  type       VARCHAR(16)     NOT NULL DEFAULT 'suggestion' COMMENT '类型：suggestion建议 bug缺陷 other其他',
  content    VARCHAR(1000)   NOT NULL COMMENT '反馈内容',
  images     JSON            NULL COMMENT '截图URL数组',
  contact    VARCHAR(128)    NOT NULL DEFAULT '' COMMENT '联系方式',
  status     VARCHAR(16)     NOT NULL DEFAULT 'pending' COMMENT '状态：pending待处理 processing处理中 replied已回复 closed已关闭',
  reply      VARCHAR(1000)   NOT NULL DEFAULT '' COMMENT '官方回复',
  handler_id BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '处理管理员ID',
  replied_at DATETIME        NULL DEFAULT NULL COMMENT '回复时间',
  created_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  updated_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
  deleted_at DATETIME(3)     NULL DEFAULT NULL COMMENT '软删除时间',
  PRIMARY KEY (id),
  KEY idx_user_id (user_id),
  KEY idx_status_created (status, created_at),
  CONSTRAINT fk_feedback_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_feedback_handler FOREIGN KEY (handler_id) REFERENCES admins (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='意见反馈表';

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- 表清单（38 张）：
-- 用户域 4：users / user_auths / badges / user_badges
-- 书库域 5：categories / tags / books / book_tags / bookshelves
-- 阅读域 2：reading_sessions / reading_goals
-- 社区域 7：reviews / booklists / booklist_items / posts / comments / likes / follows(预留)
-- 会员域 5：membership_plans / orders / member_subscriptions / payment_records / redeem_codes
-- 消息域 3：notifications / conversations(预留) / messages(预留)
-- 运营域 5：banners / topics / columns / events / event_signups
-- 管理域 7：admins / roles / admin_roles / reports / moderation_logs / operation_logs / feedback
-- =====================================================================
