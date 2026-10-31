-- =====================================================================
-- 时脉书社-阅读世界 · 联调演示数据（P0-03）
-- 覆盖场景：书城浏览 / 书架三态 / 阅读计时与时脉 / 书评评分 /
--           书单与收藏 / 打卡动态流 / 会员订阅支付 / 消息 / 运营位 /
--           活动报名 / 举报审核 / 反馈
-- 幂等：固定主键 + INSERT IGNORE（重复执行保留首批数据，不报错）
-- 时间使用 DATE_SUB(NOW(), INTERVAL n DAY) 相对生成，保证热力图/榜单新鲜
-- 演示用户（短信验证码登录，无密码）：
--   13800000001 林知秋（年卡会员） / 13800000002 沈砚书（试用会员） /
--   13800000003 苏晚（月卡会员·兑换码开通）
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 1. 用户（冗余计数与下方明细一致）
-- ---------------------------------------------------------------------
INSERT IGNORE INTO users
  (id, phone, nickname, avatar_url, gender, bio, status, is_member, member_expire_at,
   book_count, review_count, post_count, follower_count, following_count, last_login_at)
VALUES
  (1, '13800000001', '林知秋', 'https://i.pravatar.cc/200?img=47', 2, '在书页间收藏每一束光。', 'active', 1, DATE_ADD(NOW(), INTERVAL 345 DAY), 5, 4, 2, 128, 36, DATE_SUB(NOW(), INTERVAL 2 HOUR)),
  (2, '13800000002', '沈砚书', 'https://i.pravatar.cc/200?img=12', 1, '历史系在读，慢读者。',     'active', 1, DATE_ADD(NOW(), INTERVAL 4 DAY),  4, 3, 2, 64,  22, DATE_SUB(NOW(), INTERVAL 5 HOUR)),
  (3, '13800000003', '苏晚',   'https://i.pravatar.cc/200?img=32', 2, '童话与科幻之间来回横跳。', 'active', 1, DATE_ADD(NOW(), INTERVAL 20 DAY), 3, 1, 2, 210, 88, DATE_SUB(NOW(), INTERVAL 1 DAY));

INSERT IGNORE INTO user_auths (id, user_id, identity_type, identifier, credential, unionid, verified, last_used_at)
VALUES
  (1, 1, 'phone', '13800000001', '', NULL, 1, DATE_SUB(NOW(), INTERVAL 2 HOUR)),
  (2, 1, 'wechat_mp', 'o_demo_openid_linzhiqiu', '', 'u_demo_unionid_001', 1, DATE_SUB(NOW(), INTERVAL 3 DAY)),
  (3, 2, 'phone', '13800000002', '', NULL, 1, DATE_SUB(NOW(), INTERVAL 5 HOUR)),
  (4, 3, 'phone', '13800000003', '', NULL, 1, DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (5, 3, 'wechat_web', 'o_demo_openid_suwan_web', '', 'u_demo_unionid_003', 1, DATE_SUB(NOW(), INTERVAL 6 DAY));

-- 用户徽章
INSERT IGNORE INTO user_badges (id, user_id, badge_id, unlocked_at) VALUES
  (1, 1, 1, DATE_SUB(NOW(), INTERVAL 40 DAY)),
  (2, 1, 2, DATE_SUB(NOW(), INTERVAL 28 DAY)),
  (3, 1, 5, DATE_SUB(NOW(), INTERVAL 15 DAY)),
  (4, 2, 1, DATE_SUB(NOW(), INTERVAL 30 DAY)),
  (5, 2, 2, DATE_SUB(NOW(), INTERVAL 10 DAY)),
  (6, 3, 1, DATE_SUB(NOW(), INTERVAL 20 DAY));

-- ---------------------------------------------------------------------
-- 2. 图书（12 本，均已上架；封面用 picsum 占位图）
-- ---------------------------------------------------------------------
INSERT IGNORE INTO books
  (id, isbn, title, subtitle, author, translator, publisher, published_date, pages,
   cover_url, description, category_id, rating_avg, rating_count, review_count,
   shelf_count, want_count, reading_count, finished_count, short_code, status, source, created_by, published_at)
VALUES
  (1, '9787506365437', '活着',       '',               '余华',                 '',        '作家出版社',     '1993', 191,
   'https://picsum.photos/seed/book01/400/560', '地主少爷福贵跌宕一生，在苦难中咀嚼活着本身的重量。', 7,  4.90, 1024, 1, 2, 0, 1, 1, 'GsLjkSe4', 'on_shelf', 'manual', 1, DATE_SUB(NOW(), INTERVAL 200 DAY)),
  (2, '9787544253994', '百年孤独',   '',               '加西亚·马尔克斯',       '范晔',    '南海出版公司',   '2011', 360,
   'https://picsum.photos/seed/book02/400/560', '布恩迪亚家族七代人的传奇与马孔多的百年兴衰。',       8,  4.80, 2048, 1, 1, 0, 1, 0, 'E8gNTDk9', 'on_shelf', 'manual', 1, DATE_SUB(NOW(), INTERVAL 190 DAY)),
  (3, '9787508647357', '人类简史',   '从动物到上帝',   '尤瓦尔·赫拉利',         '林俊宏',  '中信出版社',     '2014', 440,
   'https://picsum.photos/seed/book03/400/560', '从认知革命到科学革命，重述智人如何成为地球主宰。',   10, 4.70, 3201, 0, 1, 1, 0, 0, 'wY2sMRhM', 'on_shelf', 'isbn',   1, DATE_SUB(NOW(), INTERVAL 180 DAY)),
  (4, '9787020042494', '小王子',     '',               '圣埃克苏佩里',         '',        '人民文学出版社', '2003', 97,
   'https://picsum.photos/seed/book04/400/560', '一位来自 B-612 小行星的王子，关于爱与驯养的寓言。', 8,  4.90, 4096, 1, 1, 0, 0, 1, 'Q6dHCLjX', 'on_shelf', 'manual', 1, DATE_SUB(NOW(), INTERVAL 170 DAY)),
  (5, '9787208061644', '追风筝的人', '',               '卡勒德·胡赛尼',         '李继宏',  '上海人民出版社', '2006', 362,
   'https://picsum.photos/seed/book05/400/560', '阿富汗少年阿米尔的救赎之路，为你，千千万万遍。',     8,  4.60, 2560, 1, 1, 0, 0, 1, 'QP6LM83B', 'on_shelf', 'manual', 1, DATE_SUB(NOW(), INTERVAL 160 DAY)),
  (6, '9787536692930', '三体',       '地球往事',       '刘慈欣',               '',        '重庆出版社',     '2008', 302,
   'https://picsum.photos/seed/book06/400/560', '红岸基地发出的一声呼唤，拉开地球文明与三体世界的序幕。', 7, 4.85, 5120, 1, 1, 0, 0, 1, '6WEL8mhc', 'on_shelf', 'manual', 1, DATE_SUB(NOW(), INTERVAL 150 DAY)),
  (7, '9787020024759', '围城',       '',               '钱钟书',               '',        '人民文学出版社', '1991', 359,
   'https://picsum.photos/seed/book07/400/560', '方鸿渐归国后的婚恋与谋职，婚姻是一座围城。',         7,  4.70, 1536, 0, 1, 1, 0, 0, 'KCKQ9pRc', 'on_shelf', 'manual', 1, DATE_SUB(NOW(), INTERVAL 140 DAY)),
  (8, '9787020002207', '红楼梦',     '',               '曹雪芹',               '',        '人民文学出版社', '1982', 1606,
   'https://picsum.photos/seed/book08/400/560', '贾史王薛四大家族盛衰，大观园里的青春挽歌。',         7,  4.95, 3072, 1, 1, 0, 0, 1, 'hBtp4u7E', 'on_shelf', 'manual', 1, DATE_SUB(NOW(), INTERVAL 130 DAY)),
  (9, '9787532761760', '局外人',     '',               '阿尔贝·加缪',           '柳鸣九',  '上海译文出版社', '2013', 128,
   'https://picsum.photos/seed/book09/400/560', '默尔索的漠然与荒诞世界的碰撞，加缪哲学代表作。',     8,  4.50, 896,  0, 0, 0, 0, 0, 'pymSsCfx', 'on_shelf', 'manual', 1, DATE_SUB(NOW(), INTERVAL 120 DAY)),
  (10, '9787532748679', '瓦尔登湖',   '',               '亨利·戴维·梭罗',       '徐迟',    '上海译文出版社', '2009', 301,
   'https://picsum.photos/seed/book10/400/560', '一个人在瓦尔登湖畔两年又两个月的独居与思考。',       8,  4.60, 1280, 1, 1, 1, 0, 0, 'ZEqAmUKs', 'on_shelf', 'manual', 1, DATE_SUB(NOW(), INTERVAL 110 DAY)),
  (11, '9787111495086', '被讨厌的勇气', '自我启发之父阿德勒的哲学课', '岸见一郎,古贺史健', '渠海霞', '机械工业出版社', '2015', 196,
   'https://picsum.photos/seed/book11/400/560', '青年与哲人的五夜对话，阿德勒心理学的通俗入门。',     14, 4.55, 3840, 1, 1, 0, 1, 0, 'kerDskHJ', 'on_shelf', 'manual', 1, DATE_SUB(NOW(), INTERVAL 100 DAY)),
  (12, '9787208171336', '置身事内',   '中国政府与经济发展', '兰小欢',               '',        '上海人民出版社', '2021', 340,
   'https://picsum.photos/seed/book12/400/560', '从地方政府视角理解中国经济的运行逻辑。',             16, 4.75, 1792, 0, 1, 0, 1, 0, 'tQyWzcJU', 'on_shelf', 'manual', 1, DATE_SUB(NOW(), INTERVAL 90 DAY));

-- 图书-标签
INSERT IGNORE INTO book_tags (id, book_id, tag_id) VALUES
  (1, 1, 1), (2, 1, 12),
  (3, 2, 1), (4, 2, 12), (5, 2, 5),
  (6, 3, 10), (7, 3, 11),
  (8, 4, 1), (9, 4, 2), (10, 4, 4),
  (11, 5, 2), (12, 5, 4), (13, 5, 12),
  (14, 6, 1), (15, 6, 7), (16, 6, 12),
  (17, 7, 1), (18, 7, 12), (19, 7, 5),
  (20, 8, 1), (21, 8, 12), (22, 8, 14),
  (23, 9, 1), (24, 9, 13), (25, 9, 5),
  (26, 10, 5), (27, 10, 8),
  (28, 11, 10), (29, 11, 2), (30, 11, 4),
  (31, 12, 10), (32, 12, 9), (33, 12, 11);

-- ---------------------------------------------------------------------
-- 3. 书架（想读 want / 在读 reading / 已读 read）
-- ---------------------------------------------------------------------
INSERT IGNORE INTO bookshelves
  (id, user_id, book_id, status, current_page, progress, last_read_at)
VALUES
  (1,  1, 1,  'read',    191, 100, DATE_SUB(NOW(), INTERVAL 25 DAY)),
  (2,  1, 2,  'reading', 210, 58,  DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (3,  1, 3,  'want',    0,   0,   NULL),
  (4,  1, 6,  'read',    302, 100, DATE_SUB(NOW(), INTERVAL 15 DAY)),
  (5,  1, 11, 'reading', 148, 75,  DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (6,  2, 8,  'read',    1606, 100, DATE_SUB(NOW(), INTERVAL 22 DAY)),
  (7,  2, 5,  'read',    362, 100, DATE_SUB(NOW(), INTERVAL 12 DAY)),
  (8,  2, 1,  'reading', 60,  31,  DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (9,  2, 10, 'want',    0,   0,   NULL),
  (10, 3, 4,  'read',    97,  100, DATE_SUB(NOW(), INTERVAL 18 DAY)),
  (11, 3, 7,  'want',    0,   0,   NULL),
  (12, 3, 12, 'reading', 150, 44,  DATE_SUB(NOW(), INTERVAL 1 DAY));

-- ---------------------------------------------------------------------
-- 4. 阅读场次（近 35 天，时脉热力图/折线数据源；33 为进行中场次）
-- ---------------------------------------------------------------------
INSERT IGNORE INTO reading_sessions
  (id, user_id, book_id, bookshelf_id, start_time, end_time, duration_seconds, start_page, end_page, note, source, status)
VALUES
  -- 林知秋（user 1）20 个已结束场次
  (1,  1, 1,  1,  DATE_SUB(NOW(), INTERVAL 33 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 33 DAY), INTERVAL 42 MINUTE), 2520,  30,  62,  '人是为活着本身而活着，而不是为了活着之外的任何事物。', 'web', 'finished'),
  (2,  1, 1,  1,  DATE_SUB(NOW(), INTERVAL 28 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 28 DAY), INTERVAL 55 MINUTE), 3300,  62,  110, '', 'web', 'finished'),
  (3,  1, 1,  1,  DATE_SUB(NOW(), INTERVAL 24 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 24 DAY), INTERVAL 38 MINUTE), 2280,  110, 145, '有庆那段几乎读不下去。', 'miniprogram', 'finished'),
  (4,  1, 6,  4,  DATE_SUB(NOW(), INTERVAL 21 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 21 DAY), INTERVAL 60 MINUTE), 3600,  10,  58,  '射手与农场主假说，头皮发麻。', 'web', 'finished'),
  (5,  1, 6,  4,  DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 20 DAY), INTERVAL 45 MINUTE), 2700,  58,  96,  '', 'web', 'finished'),
  (6,  1, 6,  4,  DATE_SUB(NOW(), INTERVAL 18 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 18 DAY), INTERVAL 50 MINUTE), 3000,  96,  140, '黑暗森林初露端倪。', 'web', 'finished'),
  (7,  1, 6,  4,  DATE_SUB(NOW(), INTERVAL 17 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 17 DAY), INTERVAL 40 MINUTE), 2400,  140, 175, '', 'miniprogram', 'finished'),
  (8,  1, 6,  4,  DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 15 DAY), INTERVAL 65 MINUTE), 3900,  175, 230, '倒计时出现的那段节奏太好了。', 'web', 'finished'),
  (9,  1, 2,  2,  DATE_SUB(NOW(), INTERVAL 14 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 14 DAY), INTERVAL 35 MINUTE), 2100,  20,  48,  '长人名需要慢慢适应。', 'web', 'finished'),
  (10, 1, 2,  2,  DATE_SUB(NOW(), INTERVAL 13 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 13 DAY), INTERVAL 48 MINUTE), 2880,  48,  80,  '', 'web', 'finished'),
  (11, 1, 2,  2,  DATE_SUB(NOW(), INTERVAL 12 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 12 DAY), INTERVAL 40 MINUTE), 2400,  80,  110, '奥雷里亚诺上校的小金鱼。', 'web', 'finished'),
  (12, 1, 11, 5,  DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 10 DAY), INTERVAL 30 MINUTE), 1800,  20,  48,  '课题分离，值得反复想。', 'miniprogram', 'finished'),
  (13, 1, 11, 5,  DATE_SUB(NOW(), INTERVAL 9 DAY),  DATE_ADD(DATE_SUB(NOW(), INTERVAL 9 DAY),  INTERVAL 42 MINUTE), 2520,  48,  80,  '', 'web', 'finished'),
  (14, 1, 11, 5,  DATE_SUB(NOW(), INTERVAL 8 DAY),  DATE_ADD(DATE_SUB(NOW(), INTERVAL 8 DAY),  INTERVAL 36 MINUTE), 2160,  80,  108, '共同体感觉。', 'web', 'finished'),
  (15, 1, 11, 5,  DATE_SUB(NOW(), INTERVAL 7 DAY),  DATE_ADD(DATE_SUB(NOW(), INTERVAL 7 DAY),  INTERVAL 28 MINUTE), 1680,  108, 130, '', 'web', 'finished'),
  (16, 1, 2,  2,  DATE_SUB(NOW(), INTERVAL 6 DAY),  DATE_ADD(DATE_SUB(NOW(), INTERVAL 6 DAY),  INTERVAL 52 MINUTE), 3120,  110, 150, '', 'web', 'finished'),
  (17, 1, 2,  2,  DATE_SUB(NOW(), INTERVAL 4 DAY),  DATE_ADD(DATE_SUB(NOW(), INTERVAL 4 DAY),  INTERVAL 46 MINUTE), 2760,  150, 182, '梅雨季的马孔多。', 'miniprogram', 'finished'),
  (18, 1, 11, 5,  DATE_SUB(NOW(), INTERVAL 3 DAY),  DATE_ADD(DATE_SUB(NOW(), INTERVAL 3 DAY),  INTERVAL 33 MINUTE), 1980,  130, 148, '', 'web', 'finished'),
  (19, 1, 2,  2,  DATE_SUB(NOW(), INTERVAL 2 DAY),  DATE_ADD(DATE_SUB(NOW(), INTERVAL 2 DAY),  INTERVAL 58 MINUTE), 3480,  182, 210, '', 'web', 'finished'),
  (20, 1, 2,  2,  DATE_SUB(NOW(), INTERVAL 1 DAY),  DATE_ADD(DATE_SUB(NOW(), INTERVAL 1 DAY),  INTERVAL 44 MINUTE), 2640,  210, 228, '', 'web', 'finished'),
  -- 沈砚书（user 2）7 场
  (21, 2, 8,  6,  DATE_SUB(NOW(), INTERVAL 22 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 22 DAY), INTERVAL 70 MINUTE), 4200,  1200, 1260, '诗词部分要配注本一起读。', 'web', 'finished'),
  (22, 2, 8,  6,  DATE_SUB(NOW(), INTERVAL 16 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 16 DAY), INTERVAL 62 MINUTE), 3720,  1260, 1330, '', 'web', 'finished'),
  (23, 2, 5,  7,  DATE_SUB(NOW(), INTERVAL 11 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 11 DAY), INTERVAL 48 MINUTE), 2880,  200, 260, '哈桑的第一次追风筝。', 'web', 'finished'),
  (24, 2, 8,  6,  DATE_SUB(NOW(), INTERVAL 8 DAY),  DATE_ADD(DATE_SUB(NOW(), INTERVAL 8 DAY),  INTERVAL 55 MINUTE), 3300,  1330, 1400, '', 'miniprogram', 'finished'),
  (25, 2, 5,  7,  DATE_SUB(NOW(), INTERVAL 5 DAY),  DATE_ADD(DATE_SUB(NOW(), INTERVAL 5 DAY),  INTERVAL 40 MINUTE), 2400,  260, 320, '', 'web', 'finished'),
  (26, 2, 1,  8,  DATE_SUB(NOW(), INTERVAL 2 DAY),  DATE_ADD(DATE_SUB(NOW(), INTERVAL 2 DAY),  INTERVAL 35 MINUTE), 2100,  20,  48,  '和红楼的笔法完全两种路数。', 'web', 'finished'),
  (27, 2, 1,  8,  DATE_SUB(NOW(), INTERVAL 1 DAY),  DATE_ADD(DATE_SUB(NOW(), INTERVAL 1 DAY),  INTERVAL 32 MINUTE), 1920,  48,  60,  '', 'web', 'finished'),
  -- 苏晚（user 3）5 场
  (28, 3, 4,  10, DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 15 DAY), INTERVAL 25 MINUTE), 1500,  40,  97,  '驯养就是建立联系。', 'miniprogram', 'finished'),
  (29, 3, 12, 12, DATE_SUB(NOW(), INTERVAL 9 DAY),  DATE_ADD(DATE_SUB(NOW(), INTERVAL 9 DAY),  INTERVAL 50 MINUTE), 3000,  40,  90,  '地方政府的土地财政逻辑讲得清楚。', 'web', 'finished'),
  (30, 3, 12, 12, DATE_SUB(NOW(), INTERVAL 4 DAY),  DATE_ADD(DATE_SUB(NOW(), INTERVAL 4 DAY),  INTERVAL 44 MINUTE), 2640,  90,  130, '', 'web', 'finished'),
  (31, 3, 12, 12, DATE_SUB(NOW(), INTERVAL 2 DAY),  DATE_ADD(DATE_SUB(NOW(), INTERVAL 2 DAY),  INTERVAL 38 MINUTE), 2280,  130, 150, '', 'miniprogram', 'finished'),
  (32, 3, 4,  10, DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_ADD(DATE_SUB(NOW(), INTERVAL 30 DAY), INTERVAL 20 MINUTE), 1200,  1,   40,  '', 'miniprogram', 'finished'),
  -- 林知秋当前进行中场次（悬浮计时器场景）
  (33, 1, 2,  2,  DATE_SUB(NOW(), INTERVAL 12 MINUTE), NULL, 0, 228, 0, '', 'web', 'ongoing');

-- 阅读目标（2026 年度）
INSERT IGNORE INTO reading_goals
  (id, user_id, goal_type, period, target_minutes, target_books, actual_minutes, actual_books, status)
VALUES
  (1, 1, 'yearly', '2026', 30000, 30, 14280, 8,  'active'),
  (2, 2, 'yearly', '2026', 20000, 20, 9600,  6,  'active'),
  (3, 3, 'yearly', '2026', 12000, 12, 4200,  3,  'active'),
  (4, 1, 'monthly', DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m'), 2400, 2, 2520, 2, 'achieved');

-- ---------------------------------------------------------------------
-- 5. 话题（posts 外键依赖，先于动态插入）
-- ---------------------------------------------------------------------
INSERT IGNORE INTO topics (id, title, description, cover_url, post_count, sort, status) VALUES
  (1, '今天你读了什么', '用一句话或一张图记录今天的阅读。', 'https://picsum.photos/seed/topic1/600/300', 1, 10, 'on'),
  (2, '秋日读书计划',   '秋天适合啃厚书，说说你的季度书单。', 'https://picsum.photos/seed/topic2/600/300', 2, 20, 'on'),
  (3, '一句话证明你读过', '不写书名，只背一句最爱的原文。', 'https://picsum.photos/seed/topic3/600/300', 0, 30, 'on'),
  (4, '我的年度书单',   '2026 年陪你最久的那本书。',       'https://picsum.photos/seed/topic4/600/300', 0, 40, 'on'),
  (5, '深夜读书打卡',   '适合夜晚的阅读仪式感。',           'https://picsum.photos/seed/topic5/600/300', 0, 50, 'on');

-- ---------------------------------------------------------------------
-- 6. 书评（8 条，全部机审通过）
-- ---------------------------------------------------------------------
INSERT IGNORE INTO reviews
  (id, short_code, user_id, book_id, rating, title, content, like_count, comment_count,
   audit_status, audit_reason, machine_score, is_featured, published_at)
VALUES
  (1, 'SJGJTScE', 1, 1,  5.0, '活着本身就是最大的意义',
   '第一次读觉得写尽了苦难，第二次读才明白它写的是承受。福贵失去了所有人，仍旧和老牛一起在田埂上走着。余华的语言极冷，读完却极热。',
   86, 12, 'approved', '', 2, 1, DATE_SUB(NOW(), INTERVAL 24 DAY)),
  (2, 'G838LQp3', 1, 6,  4.5, '给科幻入门者的一封邀请函',
   '三条故事线在文革背景下交织，宇宙尺度的恐惧和年代质感的烟火气居然毫不违和。信息密度高，但对非硬核读者依然友好。',
   64, 8, 'approved', '', 4, 0, DATE_SUB(NOW(), INTERVAL 14 DAY)),
  (3, 'Cd9qcvzm', 2, 8,  5.0, '每个年纪读都有新的译本',
   '十几岁读宝黛，二十岁读探春理家，如今再读只盯着贾府的一顿螃蟹账。它值得读一辈子，因为它写的就是一辈子。',
   102, 15, 'approved', '', 1, 1, DATE_SUB(NOW(), INTERVAL 20 DAY)),
  (4, 'HTt38hSc', 2, 5,  4.0, '真诚但略煽情的救赎',
   '前半部分的阿富汗风情和少年情谊非常动人，后半段救赎线稍显刻意，但“为你，千千万万遍”依然值得。',
   38, 5, 'approved', '', 6, 0, DATE_SUB(NOW(), INTERVAL 10 DAY)),
  (5, 'NWQwRLCW', 3, 4,  5.0, '写给大人的童话',
   '玫瑰和狐狸的对话我能背一辈子。所有大人都曾是孩子，虽然只有少数人记得。',
   120, 18, 'approved', '', 0, 1, DATE_SUB(NOW(), INTERVAL 14 DAY)),
  (6, 'QXxSVPCn', 2, 10, 4.5, '在湖畔重新计算生活的成本',
   '梭罗不是教人避世，而是教人审视：哪些是生活的必需品，哪些只是惯性。读的时候会想给自己的房间也做一次减法。',
   27, 3, 'approved', '', 3, 0, DATE_SUB(NOW(), INTERVAL 6 DAY)),
  (7, 'g9rgWumE', 1, 2,  4.5, '需要耐心的家族史诗',
   '前一百页在人名里迷路，进入节奏后完全被马孔多吸进去。结尾的飓风和开头的冰块互为镜像，合上书久久回不过神。',
   45, 6, 'approved', '', 5, 0, DATE_SUB(NOW(), INTERVAL 3 DAY)),
  (8, '64ymLahh', 1, 11, 4.0, '被讨厌是一种自由',
   '对话体降低了门槛，课题分离一章实操性最强。部分论述偏绝对，但作为自我觉察的工具书足够真诚。',
   33, 4, 'approved', '', 4, 0, DATE_SUB(NOW(), INTERVAL 2 DAY));

-- ---------------------------------------------------------------------
-- 7. 书单 + 条目 + 收藏
-- ---------------------------------------------------------------------
INSERT IGNORE INTO booklists
  (id, short_code, user_id, title, description, cover_url, item_count, collect_count, like_count,
   audit_status, is_official, published_at)
VALUES
  (1, 'cNaaNknN', 1, '独处时，适合一个人慢慢读的书',
   '不需要赶进度，不需要做笔记，翻开就能沉下去的四本。',
   'https://picsum.photos/seed/list1/600/400', 4, 36, 12, 'approved', 0, DATE_SUB(NOW(), INTERVAL 12 DAY)),
  (2, 'h8FMQBcu', 2, '入门科幻：从仰望星空开始',
   '不想一上来就被硬核设定劝退？这三本带你轻轻推开科幻的门。',
   'https://picsum.photos/seed/list2/600/400', 3, 58, 21, 'approved', 1, DATE_SUB(NOW(), INTERVAL 8 DAY));

INSERT IGNORE INTO booklist_items (id, booklist_id, book_id, sort, note) VALUES
  (1, 1, 1,  10, '最薄也最重的一本。'),
  (2, 1, 9,  20, '一个下午读完，然后发呆很久。'),
  (3, 1, 10, 30, '适合睡前读一章。'),
  (4, 1, 4,  40, '随时翻回任意一页都成立。'),
  (5, 2, 6,  10, '中文科幻的第一站。'),
  (6, 2, 3,  20, '用科幻的尺度看人类自己。'),
  (7, 2, 2,  30, '魔幻现实与科幻的交界处。');

-- ---------------------------------------------------------------------
-- 8. 打卡动态（6 条）
-- ---------------------------------------------------------------------
INSERT IGNORE INTO posts
  (id, short_code, user_id, type, book_id, topic_id, content, images, location, read_minutes,
   like_count, comment_count, audit_status, published_at)
VALUES
  (1, '3kAmUfjS', 1, 'checkin', 2,  1, '晚间阅读打卡，百年孤独进度 58%，马孔多开始下雨了。',
   NULL, '杭州·西湖区', 44, 23, 4, 'approved', DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (2, 'vtP6tZg4', 2, 'checkin', 1,  NULL, '午休摸鱼读了半小时《活着》，余华太会用短句扎人。',
   NULL, '北京·海淀区', 32, 18, 2, 'approved', DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (3, 'mEwpgdxe', 3, 'text',    NULL, 2, '秋日读书计划：十月之前把《置身事内》读完，再开一本《乡土中国》。图书馆窗外的桂花都开了。',
   JSON_ARRAY('https://picsum.photos/seed/post3a/800/600', 'https://picsum.photos/seed/post3b/800/600'),
   '南京·鼓楼区', 0, 45, 6, 'approved', DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (4, 'hJtZA25Z', 1, 'checkin', 6,  5, '深夜重读三体，第一次发现大史才是全书中最稳的人。',
   NULL, '杭州·西湖区', 50, 31, 3, 'approved', DATE_SUB(NOW(), INTERVAL 3 DAY)),
  (5, '4tFWUvQv', 2, 'text',    NULL, 2, '季度书单：红楼梦（二刷）、叫魂、明清社会经济史。欢迎互相监督。',
   NULL, '北京·海淀区', 0, 12, 3, 'approved', DATE_SUB(NOW(), INTERVAL 5 DAY)),
  (6, 'vYrrMu4Z', 3, 'checkin', 12, NULL, '通勤地铁上的 38 分钟，置身事内读到产业政策章节。',
   NULL, '南京·鼓楼区', 38, 9, 1, 'approved', DATE_SUB(NOW(), INTERVAL 2 DAY));

-- ---------------------------------------------------------------------
-- 9. 评论（8 条，多态挂书评/动态）
-- ---------------------------------------------------------------------
INSERT IGNORE INTO comments
  (id, user_id, target_type, target_id, parent_id, reply_to_uid, content, like_count, audit_status, created_at)
VALUES
  (1, 2, 'review', 1, 0, 0, '“语言极冷，读完却极热”，同感，这就是余华。', 12, 'approved', DATE_SUB(NOW(), INTERVAL 23 DAY)),
  (2, 3, 'review', 1, 1, 2, '读完在阳台站了十分钟才缓过来。',           6,  'approved', DATE_SUB(NOW(), INTERVAL 22 DAY)),
  (3, 1, 'review', 3, 0, 0, '“一顿螃蟹账”这个细节太妙了，三滴油。',     15, 'approved', DATE_SUB(NOW(), INTERVAL 19 DAY)),
  (4, 3, 'review', 5, 0, 0, '狐狸那章我直接抄进了手账。',               20, 'approved', DATE_SUB(NOW(), INTERVAL 13 DAY)),
  (5, 2, 'review', 7, 0, 0, '看到结尾飓风那段真的倒吸一口气。',         8,  'approved', DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (6, 2, 'post',   1, 0, 0, '同读到马孔多的雨！那场雨下了四年十一个月零两天。', 5, 'approved', DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (7, 1, 'post',   3, 0, 0, '桂花和秋天的图书馆，太有画面了。',         7,  'approved', DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (8, 3, 'post',   4, 0, 0, '大史是安全感的代名词。',                   4,  'approved', DATE_SUB(NOW(), INTERVAL 3 DAY));

-- 点赞/收藏（12 条；含 2 条书单收藏 interaction_type=collect）
INSERT IGNORE INTO likes (id, user_id, target_type, target_id, interaction_type, created_at) VALUES
  (1,  2, 'review', 1, 'like',    DATE_SUB(NOW(), INTERVAL 23 DAY)),
  (2,  3, 'review', 1, 'like',    DATE_SUB(NOW(), INTERVAL 22 DAY)),
  (3,  1, 'review', 3, 'like',    DATE_SUB(NOW(), INTERVAL 19 DAY)),
  (4,  3, 'review', 3, 'like',    DATE_SUB(NOW(), INTERVAL 18 DAY)),
  (5,  2, 'review', 5, 'like',    DATE_SUB(NOW(), INTERVAL 13 DAY)),
  (6,  1, 'review', 5, 'like',    DATE_SUB(NOW(), INTERVAL 12 DAY)),
  (7,  3, 'review', 7, 'like',    DATE_SUB(NOW(), INTERVAL 3 DAY)),
  (8,  1, 'post',   3, 'like',    DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (9,  2, 'post',   3, 'like',    DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (10, 3, 'booklist', 1, 'collect', DATE_SUB(NOW(), INTERVAL 10 DAY)),
  (11, 2, 'booklist', 1, 'collect', DATE_SUB(NOW(), INTERVAL 9 DAY)),
  (12, 1, 'booklist', 2, 'collect', DATE_SUB(NOW(), INTERVAL 7 DAY));

-- ---------------------------------------------------------------------
-- 10. 运营位：Banner / 每周好书 / 活动与报名
-- ---------------------------------------------------------------------
INSERT IGNORE INTO banners (id, title, image_url, position, link_type, link_value, sort, start_time, end_time, status, created_by) VALUES
  (1, '秋日阅读企划 · 记录每一次脉动', 'https://picsum.photos/seed/banner1/1200/400', 'home_top', 'web',  '/activity/autumn', 10, DATE_SUB(NOW(), INTERVAL 30 DAY), DATE_ADD(NOW(), INTERVAL 60 DAY), 'on', 1),
  (2, '每周好书 · 置身事内',           'https://picsum.photos/seed/banner2/1200/400', 'home_top', 'book', '12',               20, DATE_SUB(NOW(), INTERVAL 7 DAY),  DATE_ADD(NOW(), INTERVAL 7 DAY),  'on', 1),
  (3, '年卡会员限时 8 折',             'https://picsum.photos/seed/banner3/1200/400', 'home_top', 'web',  '/membership',      30, DATE_SUB(NOW(), INTERVAL 3 DAY),  DATE_ADD(NOW(), INTERVAL 14 DAY), 'on', 1);

INSERT IGNORE INTO `columns`
  (id, type, title, subtitle, book_id, cover_url, content, sort, status, published_at, created_by)
VALUES
  (1, 'weekly_pick', '每周好书 · 第 38 周', '在宏大叙事里看见每个具体的人', 12,
   'https://picsum.photos/seed/weekly1/600/400', NULL, 10, 'on', DATE_SUB(NOW(), INTERVAL 7 DAY), 1),
  (2, 'weekly_pick', '每周好书 · 第 37 周', '所有的孤独都写在这一本书里', 2,
   'https://picsum.photos/seed/weekly2/600/400', NULL, 20, 'on', DATE_SUB(NOW(), INTERVAL 14 DAY), 1),
  (3, 'column', '编辑专栏 · 为什么我们还要读长篇',
   '在信息碎片化的年代，长篇小说给人的耐心训练无可替代。',
   NULL, 'https://picsum.photos/seed/column3/600/400',
   '我们相信，愿意花二十个小时跟随一个人物走完一生的人，会更理解身边的人。', 30, 'on', DATE_SUB(NOW(), INTERVAL 5 DAY), 1);

INSERT IGNORE INTO events
  (id, title, type, cover_url, description, start_time, end_time, signup_start, signup_end,
   capacity, signup_count, member_only, status, created_by)
VALUES
  (1, '金秋共读营 · 中国文学经典七日谈', 'reading_camp', 'https://picsum.photos/seed/event1/800/400',
   '与百位读友共读《活着》，每日一个讨论题，编辑带队直播收官。',
   DATE_ADD(NOW(), INTERVAL 5 DAY), DATE_ADD(NOW(), INTERVAL 12 DAY),
   DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_ADD(NOW(), INTERVAL 4 DAY),
   200, 3, 0, 'ongoing', 1);

INSERT IGNORE INTO event_signups (id, event_id, user_id, status, signup_time) VALUES
  (1, 1, 1, 'signed', DATE_SUB(NOW(), INTERVAL 8 DAY)),
  (2, 1, 2, 'signed', DATE_SUB(NOW(), INTERVAL 6 DAY)),
  (3, 1, 3, 'signed', DATE_SUB(NOW(), INTERVAL 3 DAY));

-- ---------------------------------------------------------------------
-- 11. 会员交易：订单 / 订阅 / 支付流水 / 兑换码
-- ---------------------------------------------------------------------
-- 林知秋：年卡微信支付
INSERT IGNORE INTO orders
  (id, order_no, user_id, plan_id, order_type, title, amount_fen, status, channel,
   paid_at, closed_at, refunded_at, refund_reason, remark, created_at)
VALUES
  (1, 'SO202609010001', 1, 2, 'subscription', '年卡会员', 28800, 'paid', 'wechat',
   DATE_SUB(NOW(), INTERVAL 20 DAY), NULL, NULL, '', '', DATE_SUB(NOW(), INTERVAL 20 DAY));

-- 苏晚：兑换码兑换（0 元单）
INSERT IGNORE INTO orders
  (id, order_no, user_id, plan_id, order_type, title, amount_fen, status, channel,
   paid_at, closed_at, refunded_at, refund_reason, remark, created_at)
VALUES
  (2, 'RC202609110002', 3, 1, 'redeem', '兑换码开通·月卡会员', 0, 'paid', 'redeem',
   DATE_SUB(NOW(), INTERVAL 10 DAY), NULL, NULL, '', '兑换码 VIP-MONTH-BBBB', DATE_SUB(NOW(), INTERVAL 10 DAY));

INSERT IGNORE INTO member_subscriptions
  (id, user_id, plan_id, order_id, start_time, expire_time, status, auto_renew, channel,
   remind_7_sent, remind_3_sent, remind_1_sent)
VALUES
  (1, 1, 2, 1, DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_ADD(NOW(), INTERVAL 345 DAY), 'active', 1, 'wechat', 0, 0, 0),
  (2, 2, 1, NULL, DATE_SUB(NOW(), INTERVAL 3 DAY), DATE_ADD(NOW(), INTERVAL 4 DAY), 'trialing', 0, 'trial', 0, 0, 0),
  (3, 3, 1, 2, DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_ADD(NOW(), INTERVAL 20 DAY), 'active', 0, 'redeem', 0, 0, 0);

INSERT IGNORE INTO payment_records
  (id, order_id, payment_no, transaction_id, channel, amount_fen, status, raw_callback, paid_at, created_at)
VALUES
  (1, 1, 'PAY202609010001', 'wx_txn_demo_20260901001', 'wechat', 28800, 'success',
   JSON_OBJECT('trade_state', 'SUCCESS', 'bank_type', 'CFT'), DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_SUB(NOW(), INTERVAL 20 DAY));

INSERT IGNORE INTO redeem_codes
  (id, code, batch_no, plan_id, duration_days, status, used_by, used_at, order_id, expires_at, created_by)
VALUES
  (1, 'VIP-MONTH-AAAA', 'BATCH-2026-09', 1, 30, 'unused',   NULL, NULL, NULL, DATE_ADD(NOW(), INTERVAL 90 DAY), 1),
  (2, 'VIP-MONTH-BBBB', 'BATCH-2026-09', 1, 30, 'used',     3, DATE_SUB(NOW(), INTERVAL 10 DAY), 2, DATE_ADD(NOW(), INTERVAL 80 DAY), 1),
  (3, 'VIP-TEST-DISABLED', 'BATCH-TEST', 1, 30, 'disabled', NULL, NULL, NULL, DATE_ADD(NOW(), INTERVAL 90 DAY), 1);

-- ---------------------------------------------------------------------
-- 12. 站内通知
-- ---------------------------------------------------------------------
INSERT IGNORE INTO notifications (id, user_id, type, title, content, sender_id, target_type, target_id, is_read, read_at, created_at) VALUES
  (1, 1, 'like',    '你的书评收到了新的赞',     '沈砚书 赞了你的书评《活着本身就是最大的意义》', 2, 'review', 1, 1, DATE_SUB(NOW(), INTERVAL 23 DAY), DATE_SUB(NOW(), INTERVAL 23 DAY)),
  (2, 1, 'comment', '你的书评收到了新评论',     '沈砚书：“语言极冷，读完却极热”，同感……',       2, 'review', 1, 1, DATE_SUB(NOW(), INTERVAL 22 DAY), DATE_SUB(NOW(), INTERVAL 22 DAY)),
  (3, 3, 'system',  '欢迎加入时脉书社',         '完成第一次阅读计时，点亮「初次脉动」徽章。',     0, 'badge',  1, 1, DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_SUB(NOW(), INTERVAL 20 DAY)),
  (4, 1, 'order',   '会员开通成功',             '年卡会员已开通，有效期至 2027 年。',            0, 'order',  1, 1, DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_SUB(NOW(), INTERVAL 20 DAY)),
  (5, 2, 'system',  '试用已过半',               '你的 7 天会员试用还剩 4 天，可随时开通正式会员。', 0, '', 0, 0, NULL, DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (6, 3, 'audit',   '你的书评已通过审核',       '书评《写给大人的童话》已通过审核并发布。',       0, 'review', 5, 0, NULL, DATE_SUB(NOW(), INTERVAL 14 DAY));

-- ---------------------------------------------------------------------
-- 13. 反馈 / 举报 / 审核日志 / 操作日志（管理端演示）
-- ---------------------------------------------------------------------
INSERT IGNORE INTO feedback
  (id, user_id, type, content, images, contact, status, reply, handler_id, replied_at)
VALUES
  (1, 2, 'bug',        '时脉报告页在 Safari 下热力图最后一列被截断。',
   JSON_ARRAY('https://picsum.photos/seed/fb1/800/600'), '13800000002', 'replied',
   '已在 P1-07 修复列表中登记，下个版本发布，感谢反馈！', 1, DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (2, 1, 'suggestion', '希望时脉报告支持按「书籍」维度看时长占比。',
   NULL, '', 'pending', '', NULL, NULL);

INSERT IGNORE INTO reports
  (id, reporter_id, reporter_type, target_type, target_id, reason, description, images,
   status, handler_id, handle_result, handled_at)
VALUES
  (1, 2, 'user', 'post', 3, 'ad', '疑似营销引流内容，请核实。', NULL, 'pending', NULL, '', NULL);

INSERT IGNORE INTO moderation_logs
  (id, target_type, target_id, action, reason, operator_type, operator_id, detail, created_at)
VALUES
  (1, 'review', 1, 'machine', '机审通过', 'machine', 0, JSON_OBJECT('score', 2, 'provider', 'tencent_cms'), DATE_SUB(NOW(), INTERVAL 24 DAY)),
  (2, 'review', 5, 'machine', '机审通过', 'machine', 0, JSON_OBJECT('score', 0, 'provider', 'tencent_cms'), DATE_SUB(NOW(), INTERVAL 14 DAY));

INSERT IGNORE INTO operation_logs
  (id, admin_id, username, module, action, method, path, params, ip, user_agent, status_code, duration_ms, created_at)
VALUES
  (1, 1, 'admin', 'book',    'create', 'POST', '/api/admin/books',     JSON_OBJECT('id', 12, 'title', '置身事内'), '127.0.0.1', 'Mozilla/5.0 Chrome/128', 201, 42, DATE_SUB(NOW(), INTERVAL 90 DAY)),
  (2, 1, 'admin', 'auth',    'login',  'POST', '/api/admin/auth/login', JSON_OBJECT('username', 'admin'),          '127.0.0.1', 'Mozilla/5.0 Chrome/128', 200, 88, DATE_SUB(NOW(), INTERVAL 1 DAY));

-- ---------------------------------------------------------------------
-- 完成。重复执行本脚本不会产生重复数据（INSERT IGNORE + 固定主键）。
-- ---------------------------------------------------------------------
