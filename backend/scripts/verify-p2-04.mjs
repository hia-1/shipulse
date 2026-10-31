/**
 * P2-04（消息中心）端到端验收脚本。
 *
 * 前置：后端以 NODE_ENV=dev 运行于 127.0.0.1:3000，MySQL 可用（库 shipulse）。
 * 用法：node scripts/verify-p2-04.mjs
 *
 * 覆盖验收点：
 *  点赞/评论实时产生通知 / 未读角标数量准确 / 标记已读生效且角标同步 / 分类 Tab 过滤正确
 *  附加：自触发抑制、用户间消息隔离、分页、数据库落库校验
 */
import mysql from 'mysql2/promise';

const BASE = 'http://127.0.0.1:3000/api';
let pass = 0;
let fail = 0;

function log(ok, name, detail = '') {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`);
}

async function api(method, path, { body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

/** 解包统一响应体 { code, message, data } */
const D = (r) => (r.body && typeof r.body === 'object' && 'data' in r.body ? r.body.data : r.body);

const rnd8 = () => String(Math.floor(10000000 + Math.random() * 89999999));

async function loginOrRegister(phone, nickname) {
  let r = await api('POST', '/auth/register', { body: { phone, code: '123456', nickname } });
  if (r.status === 201) return D(r);
  r = await api('POST', '/auth/login', { body: { phone, code: '123456' } });
  return D(r);
}

/** 读取某用户未读通知（直接查库，用于交叉校验接口返回值） */
async function dbUnread(db, userId) {
  const [rows] = await db.query(
    'SELECT type, COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND is_read = 0 GROUP BY type',
    [userId],
  );
  const map = {};
  let total = 0;
  for (const r of rows) {
    map[r.type] = Number(r.cnt);
    total += Number(r.cnt);
  }
  return { total, map };
}

const db = await mysql.createConnection({
  host: '127.0.0.1',
  port: 3306,
  user: 'shipulse',
  password: 'change_me',
  database: 'shipulse',
});

try {
  // ============ 前置检查 ============
  const ping = await api('GET', '/admin/ping');
  log(ping.status === 200, '前置：后端存活', `status=${ping.status}`);

  const phoneA = `139${rnd8()}`;
  const phoneB = `139${rnd8()}`;
  const phoneC = `139${rnd8()}`;
  const uA = await loginOrRegister(phoneA, '消息验收A');
  const uB = await loginOrRegister(phoneB, '消息验收B');
  const uC = await loginOrRegister(phoneC, '消息验收C');
  const tokenA = uA?.accessToken;
  const tokenB = uB?.accessToken;
  const tokenC = uC?.accessToken;
  const idA = uA?.user?.id;
  const idB = uB?.user?.id;
  const idC = uC?.user?.id;
  log(
    !!tokenA && !!tokenB && !!tokenC,
    '前置：注册/登录三个用户',
    `A=${idA} B=${idB} C=${idC}`,
  );
  if (!tokenA || !tokenB || !tokenC) {
    throw new Error('前置登录失败，请确认后端以 NODE_ENV=dev 启动（固定验证码 123456）');
  }

  const books = await api('GET', '/library/books?page=1&pageSize=1');
  const bookId = D(books)?.list?.[0]?.id;
  log(!!bookId, '前置：取一本书用于发评', `bookId=${bookId}`);
  if (!bookId) throw new Error('书库为空，无法继续验收');

  console.log('\n---------- P2-04 消息中心 ----------');

  // A 发布一条书评（机审通过即发布）
  const createReview = await api('POST', '/community/reviews', {
    token: tokenA,
    body: {
      bookId,
      rating: 4,
      title: `消息验收书评_${Date.now()}`,
      content: '用于验证点赞/评论通知触发的书评内容。',
    },
  });
  const myReviews = await api('GET', '/community/reviews/my?page=1&pageSize=1', { token: tokenA });
  const reviewId = D(myReviews)?.list?.[0]?.id;
  log(
    (createReview.status === 200 || createReview.status === 201) && !!reviewId,
    '前置：用户A发布书评',
    `status=${createReview.status} reviewId=${reviewId}`,
  );
  if (!reviewId) throw new Error('书评创建失败，无法继续验收');

  // A 初始未读应为 0（新注册用户）
  const baseUnread = await api('GET', '/notifications/unread-count', { token: tokenA });
  log(
    baseUnread.status === 200 && D(baseUnread)?.total === 0,
    '未读数初始为 0',
    `status=${baseUnread.status} total=${D(baseUnread)?.total}`,
  );

  // ===== 1. 点赞触发通知 =====
  const like = await api('POST', `/community/reviews/${reviewId}/like`, { token: tokenB });
  log(like.status === 200 || like.status === 201, 'B 点赞 A 的书评', `status=${like.status}`);

  const afterLike = await api('GET', '/notifications/unread-count', { token: tokenA });
  log(
    D(afterLike)?.total === 1 && D(afterLike)?.like === 1,
    '点赞实时产生通知且未读数准确',
    `total=${D(afterLike)?.total} like=${D(afterLike)?.like}`,
  );

  // ===== 2. 自触发抑制（A 点赞自己的书评） =====
  await api('POST', `/community/reviews/${reviewId}/like`, { token: tokenA });
  const afterSelfLike = await api('GET', '/notifications/unread-count', { token: tokenA });
  log(
    D(afterSelfLike)?.total === 1,
    '自赞不产生通知（自触发抑制）',
    `total=${D(afterSelfLike)?.total}（应仍为 1）`,
  );

  // ===== 3. 评论触发通知 =====
  const commentByB = await api('POST', `/community/reviews/${reviewId}/comments`, {
    token: tokenB,
    body: { content: '这是 B 对 A 书评的评论，用于验证通知触发。' },
  });
  const commentBId = D(commentByB)?.id;
  log(
    (commentByB.status === 200 || commentByB.status === 201) && !!commentBId,
    'B 评论 A 的书评',
    `status=${commentByB.status} commentId=${commentBId}`,
  );

  const afterComment = await api('GET', '/notifications/unread-count', { token: tokenA });
  log(
    D(afterComment)?.total === 2 && D(afterComment)?.comment === 1,
    '评论实时产生通知且未读数准确',
    `total=${D(afterComment)?.total} comment=${D(afterComment)?.comment}`,
  );

  // ===== 4. 回复触发通知（通知被回复者 B + 书评作者 A） =====
  const replyByC = await api('POST', `/community/reviews/${reviewId}/comments`, {
    token: tokenC,
    body: { content: '这是 C 对 B 评论的回复。', parentId: commentBId },
  });
  log(
    replyByC.status === 200 || replyByC.status === 201,
    'C 回复 B 的评论',
    `status=${replyByC.status}`,
  );

  const afterReplyA = await api('GET', '/notifications/unread-count', { token: tokenA });
  const afterReplyB = await api('GET', '/notifications/unread-count', { token: tokenB });
  log(
    D(afterReplyA)?.total === 3 && D(afterReplyA)?.comment === 2,
    '回复通知书评作者 A',
    `A total=${D(afterReplyA)?.total} comment=${D(afterReplyA)?.comment}`,
  );
  log(
    D(afterReplyB)?.total === 1 && D(afterReplyB)?.comment === 1,
    '回复额外通知被回复者 B',
    `B total=${D(afterReplyB)?.total} comment=${D(afterReplyB)?.comment}`,
  );

  // ===== 5. 未读数与数据库一致（角标准确性） =====
  const dbA = await dbUnread(db, idA);
  log(
    dbA.total === D(afterReplyA)?.total,
    '未读角标与数据库一致',
    `api=${D(afterReplyA)?.total} db=${dbA.total}`,
  );

  // ===== 6. 分类 Tab 过滤 =====
  const listLike = await api('GET', '/notifications?type=like&page=1&pageSize=20', { token: tokenA });
  const likeList = D(listLike)?.list ?? [];
  log(
    listLike.status === 200 &&
      D(listLike)?.total === 1 &&
      likeList.length === 1 &&
      likeList.every((n) => n.category === 'like'),
    '分类 Tab：点赞过滤正确',
    `total=${D(listLike)?.total} categories=${[...new Set(likeList.map((n) => n.category))].join(',')}`,
  );

  const listComment = await api('GET', '/notifications?type=comment&page=1&pageSize=20', {
    token: tokenA,
  });
  const commentList = D(listComment)?.list ?? [];
  log(
    D(listComment)?.total === 2 && commentList.every((n) => n.category === 'comment'),
    '分类 Tab：评论过滤正确',
    `total=${D(listComment)?.total}`,
  );

  const listAll = await api('GET', '/notifications?type=all&page=1&pageSize=20', { token: tokenA });
  log(D(listAll)?.total === 3, '分类 Tab：全部返回 3 条', `total=${D(listAll)?.total}`);

  const listSystem = await api('GET', '/notifications?type=system&page=1&pageSize=20', {
    token: tokenA,
  });
  log(D(listSystem)?.total === 0, '分类 Tab：系统为空', `total=${D(listSystem)?.total}`);

  // ===== 7. 用户间消息隔离 =====
  const listB = await api('GET', '/notifications?type=all&page=1&pageSize=20', { token: tokenB });
  const bItems = D(listB)?.list ?? [];
  log(
    D(listB)?.total === 1 && bItems.every((n) => String(n.senderId) === String(idC)),
    '消息隔离：B 只能看到自己的通知',
    `total=${D(listB)?.total}`,
  );

  // ===== 8. 通知内容与触发者信息 =====
  const likeItem = likeList[0];
  log(
    !!likeItem &&
      String(likeItem.senderId) === String(idB) &&
      likeItem.sender?.nickname === '消息验收B' &&
      likeItem.targetType === 'review' &&
      String(likeItem.targetId) === String(reviewId) &&
      likeItem.isRead === false,
    '点赞通知携带触发者与跳转对象',
    `sender=${likeItem?.sender?.nickname} target=${likeItem?.targetType}#${likeItem?.targetId}`,
  );

  // ===== 9. 分页 =====
  const page1 = await api('GET', '/notifications?type=all&page=1&pageSize=1', { token: tokenA });
  const page2 = await api('GET', '/notifications?type=all&page=2&pageSize=1', { token: tokenA });
  log(
    (D(page1)?.list ?? []).length === 1 &&
      (D(page2)?.list ?? []).length === 1 &&
      D(page1)?.list?.[0]?.id !== D(page2)?.list?.[0]?.id,
    '分页返回不同记录',
    `p1=${D(page1)?.list?.[0]?.id} p2=${D(page2)?.list?.[0]?.id}`,
  );

  // ===== 10. 单条标记已读，角标同步 =====
  const targetNote = commentList[0];
  const markOne = await api('PATCH', `/notifications/${targetNote.id}/read`, { token: tokenA });
  log(markOne.status === 200, '单条标记已读', `status=${markOne.status} id=${targetNote.id}`);

  const afterMarkOne = await api('GET', '/notifications/unread-count', { token: tokenA });
  log(
    D(afterMarkOne)?.total === 2 && D(afterMarkOne)?.comment === 1,
    '标记已读后角标同步更新',
    `total=${D(afterMarkOne)?.total} comment=${D(afterMarkOne)?.comment}`,
  );

  // 越权：B 不能标记 A 的通知
  const crossMark = await api('PATCH', `/notifications/${targetNote.id}/read`, { token: tokenB });
  log(crossMark.status === 404, '越权标记他人通知被拒（404）', `status=${crossMark.status}`);

  // ===== 11. 全部标记已读 =====
  const markAll = await api('PATCH', '/notifications/read-all', { token: tokenA });
  const afterMarkAll = await api('GET', '/notifications/unread-count', { token: tokenA });
  log(
    markAll.status === 200 && D(afterMarkAll)?.total === 0,
    '全部标记已读且角标归零',
    `updated=${D(markAll)?.updated} total=${D(afterMarkAll)?.total}`,
  );

  // 已读状态落库
  const dbAfter = await dbUnread(db, idA);
  log(dbAfter.total === 0, '已读状态已落库', `db unread=${dbAfter.total}`);

  // ===== 12. 数据库落库校验 =====
  const [rows] = await db.query(
    'SELECT type, sender_id, target_type, target_id FROM notifications WHERE user_id = ? ORDER BY id',
    [idA],
  );
  const likeRow = rows.find((r) => r.type === 'like');
  log(
    rows.length === 3 &&
      !!likeRow &&
      String(likeRow.sender_id) === String(idB) &&
      likeRow.target_type === 'review' &&
      String(likeRow.target_id) === String(reviewId),
    '通知落库字段正确（类型/触发者/对象）',
    `rows=${rows.length}`,
  );
} catch (e) {
  fail += 1;
  console.error('SCRIPT ERROR:', e?.message || e);
} finally {
  await db.end();
}

console.log(`\n===== P2-04 验收结果：PASS ${pass} / FAIL ${fail} =====`);
process.exit(fail === 0 ? 0 : 1);