-- =====================================================================
-- P2-08 小程序订阅消息接入（幂等，可重复执行）
-- 作用：新增 subscribe_authorizations 表，记录用户对订阅消息模板的授权额度。
--       微信「一次性订阅」每授权一次可下发一条：count 累加授权、发送成功后扣减，
--       额度耗尽时小程序需引导用户重新授权。
-- 用法（本机）：
--   mysql -h127.0.0.1 -P3306 -u shipulse -pchange_me shipulse < db/init/06_p2_08_subscribe.sql
-- =====================================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS subscribe_authorizations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  user_id BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  template_id VARCHAR(64) NOT NULL COMMENT '订阅消息模板ID',
  count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '剩余可下发额度',
  last_authorized_at DATETIME NULL COMMENT '最近一次授权时间',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_template (user_id, template_id),
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='微信订阅消息授权记录';
