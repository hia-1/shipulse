-- =====================================================================
-- P2-05 分享短码防枚举修复（幂等，可重复执行）
-- 作用：把历史演示数据中「前缀+自增序号」的可枚举短码
--       （books.bk000001 / reviews.rv000001 / booklists.bl000001 / posts.pt000001）
--       替换为随机 8 位短码（字符集剔除易混字符 I O l 0 1），避免分享链接被批量遍历。
-- 说明：全新库由 03_seed_demo.sql 直接写入随机短码，无需本迁移；
--       本文件仅用于修复「已初始化」的旧库。
--       随机表达式必须写在 UPDATE 的 SET 子句内（RAND() 逐行求值），
--       不能先 SET 到用户变量，否则整表会被赋成同一个值而撞唯一键。
-- 用法（本机）：
--   mysql -h127.0.0.1 -P3306 -u shipulse -pchange_me shipulse < db/init/05_p2_05_shortcode_fix.sql
-- =====================================================================

SET NAMES utf8mb4;

-- 安全字符集：A-H J-N P-Z a-k m-z 2-9（56 个字符，无 I O l 0 1）
SET @alpha := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
SET @len := CHAR_LENGTH(@alpha);

UPDATE books SET short_code = CONCAT(
  SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1), SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1),
  SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1), SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1),
  SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1), SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1),
  SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1), SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1)
) WHERE short_code REGEXP '^bk[0-9]{6}$';

UPDATE reviews SET short_code = CONCAT(
  SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1), SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1),
  SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1), SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1),
  SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1), SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1),
  SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1), SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1)
) WHERE short_code REGEXP '^rv[0-9]{6}$';

UPDATE booklists SET short_code = CONCAT(
  SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1), SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1),
  SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1), SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1),
  SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1), SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1),
  SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1), SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1)
) WHERE short_code REGEXP '^bl[0-9]{6}$';

UPDATE posts SET short_code = CONCAT(
  SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1), SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1),
  SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1), SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1),
  SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1), SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1),
  SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1), SUBSTRING(@alpha, FLOOR(1 + RAND() * @len), 1)
) WHERE short_code REGEXP '^pt[0-9]{6}$';