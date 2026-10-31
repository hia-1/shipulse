-- =====================================================================
-- P2-12 / P2-15 增量迁移（幂等，可重复执行）
-- 作用：为「已初始化」的数据库补齐新增结构；全新库由 01_schema.sql 直接建好
--   · users.muted_until        禁言到期时间
--   · appeals                  违规申诉表
-- 用法（本机）：
--   mysql -h127.0.0.1 -P3306 -u shipulse -pchange_me shipulse < db/init/04_p2_12_15_migration.sql
-- =====================================================================

SET NAMES utf8mb4;

-- ---------- users.muted_until ----------
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'muted_until'
);
SET @sql := IF(@col = 0,
  'ALTER TABLE users ADD COLUMN muted_until DATETIME NULL DEFAULT NULL COMMENT ''禁言到期时间（status=muted 时有效；到期自动恢复）'' AFTER status',
  'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ---------- appeals ----------
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
