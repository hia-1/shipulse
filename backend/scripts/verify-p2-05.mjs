/**
 * P2-05（分享裂变）端到端验收脚本。
 *
 * 前置：后端以 NODE_ENV=dev 运行于 127.0.0.1:3000，MySQL 可用（库 shipulse）。
 * 用法：node scripts/verify-p2-05.mjs
 *
 * 覆盖验收点：
 *  三种卡片（时脉/书单/书评金句）生成卡片数据 / 短码不可枚举 /
 *  落地页正确还原分享内容 / 落地页含注册与访问引导入口（path）
 *  附加：短码复用实体列且落库、非法码 404、未登录不能生成时脉分享
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
const CODE_RE = /^[A-HJ-NP-Za-km-z2-9]{8}$/;

async function loginOrRegister(phone, nickname) {
  let r = await api('POST', '/auth/register', { body: { phone, code: '123456', nickname } });
  if (r.status === 201) return D(r);
  r = await api('POST', '/auth/login', { body: { phone, code: '123456' } });
  return D(r);
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

  const phoneU = `139${rnd8()}`;
  const uUser = await loginOrRegister(phoneU, '分享验收用户');
  const tokenU = uUser?.accessToken;
  log(!!tokenU, '前置：注册/登录用户', `phone=${phoneU}`);
  if (!tokenU) throw new Error('前置登录失败，请确认后端以 NODE_ENV=dev 启动（固定验证码 123456）');

  const books = await api('GET', '/library/books?page=1&pageSize=5');
  const bookList = D(books)?.list ?? [];
  const bookId = bookList[0]?.id;
  log(!!bookId, '前置：取图书用于分享', `bookId=${bookId}`);
  if (!bookId) throw new Error('书库为空，无法继续验收');

  console.log('\n---------- P2-05 分享裂变 ----------');

  // ===== 1. 书评金句卡片 =====
  const rvTitle = `分享验收书评_${Date.now()}`;
  const createReview = await api('POST', '/community/reviews', {
    token: tokenU,
    body: { bookId, rating: 4.5, title: rvTitle, content: '分享卡片验收：愿每一次阅读都被温柔记录。' },
  });
  const myReviews = await api('GET', '/community/reviews/my?page=1&pageSize=1', { token: tokenU });
  const reviewId = D(myReviews)?.list?.[0]?.id;
  log(
    (createReview.status === 200 || createReview.status === 201) && !!reviewId,
    '前置：发布一条书评',
    `status=${createReview.status} reviewId=${reviewId}`,
  );

  const shareReview = await api('POST', '/share', {
    token: tokenU,
    body: { type: 'review', targetId: Number(reviewId) },
  });
  const rCard = D(shareReview)?.card;
  const rCode = D(shareReview)?.code;
  log(
    (shareReview.status === 200 || shareReview.status === 201) && rCard?.template === 'review',
    '书评金句卡片生成（template=review）',
    `status=${shareReview.status} code=${rCode}`,
  );
  log(
    CODE_RE.test(rCode || '') && !/^\d+$/.test(rCode || ''),
    '短码为随机串（非自增数字、8 位）',
    `code=${rCode}`,
  );
  log(!!rCard?.quote && !!rCard?.title, '书评卡片含金句与标题', `quote=${(rCard?.quote || '').slice(0, 16)}…`);

  const landReview = await api('GET', `/share/${rCode}`);
  const rContent = D(landReview)?.content;
  log(
    landReview.status === 200 &&
      rContent?.type === 'review' &&
      rContent?.path === `/reviews/${reviewId}`,
    '落地页还原书评内容与站内路径',
    `status=${landReview.status} path=${rContent?.path}`,
  );
  log(!!rContent?.author?.nickname && !!D(landReview)?.card, '落地页含作者与卡片（引导访问）');

  // 短码复用实体列并落库
  const [rvRow] = await db.query('SELECT short_code FROM reviews WHERE id = ?', [reviewId]);
  log(rvRow[0]?.short_code === rCode, '短码复用并落库到 reviews.short_code', `db=${rvRow[0]?.short_code}`);

  // ===== 2. 图书卡片（首次生成短码并落库） =====
  const shareBook = await api('POST', '/share', {
    token: tokenU,
    body: { type: 'book', targetId: Number(bookId) },
  });
  const bCode = D(shareBook)?.code;
  log(
    (shareBook.status === 200 || shareBook.status === 201) && CODE_RE.test(bCode || ''),
    '图书分享生成短码',
    `status=${shareBook.status} code=${bCode}`,
  );
  const [bkRow] = await db.query('SELECT short_code FROM books WHERE id = ?', [bookId]);
  log(bkRow[0]?.short_code === bCode, '图书短码落库到 books.short_code', `db=${bkRow[0]?.short_code}`);
  const landBook = await api('GET', `/share/${bCode}`);
  log(
    landBook.status === 200 && D(landBook)?.content?.type === 'book',
    '落地页还原图书内容',
    `path=${D(landBook)?.content?.path}`,
  );

  // ===== 3. 书单卡片 =====
  let blCode = null;
  let blId = null;
  const [blRows] = await db.query(
    "SELECT id, short_code FROM booklists WHERE audit_status='approved' AND short_code IS NOT NULL AND deleted_at IS NULL LIMIT 1",
  );
  if (blRows[0]) {
    blId = blRows[0].id;
    blCode = blRows[0].short_code;
  } else {
    const created = await api('POST', '/booklists', {
      token: tokenU,
      body: { title: `分享验收书单_${Date.now()}`, description: '用于分享裂变验收的书单' },
    });
    blId = D(created)?.id;
    const [r2] = await db.query('SELECT short_code FROM booklists WHERE id = ?', [blId]);
    blCode = r2[0]?.short_code;
  }
  if (blId && blCode) {
    const shareBl = await api('POST', '/share', {
      token: tokenU,
      body: { type: 'booklist', targetId: Number(blId) },
    });
    const blCard = D(shareBl)?.card;
    log(
      (shareBl.status === 200 || shareBl.status === 201) && blCard?.template === 'booklist',
      '书单卡片生成（template=booklist）',
      `status=${shareBl.status} stats=${(blCard?.stats || []).map((s) => s.label).join('/')}`,
    );
    const landBl = await api('GET', `/share/${D(shareBl)?.code}`);
    log(
      landBl.status === 200 && D(landBl)?.content?.type === 'booklist',
      '落地页还原书单内容',
      `path=${D(landBl)?.content?.path}`,
    );
  } else {
    log(false, '书单卡片生成', '未取到可用书单');
  }

  // ===== 4. 时脉卡片 =====
  const sharePulse = await api('POST', '/share', { token: tokenU, body: { type: 'pulse', targetId: 1 } });
  const pCard = D(sharePulse)?.card;
  const pCode = D(sharePulse)?.code;
  log(
    (sharePulse.status === 200 || sharePulse.status === 201) &&
      pCard?.template === 'pulse' &&
      /^p\d{1,10}x[A-Za-z0-9]{8}$/.test(pCode || ''),
    '时脉卡片生成（template=pulse，签名短码）',
    `status=${sharePulse.status} code=${pCode}`,
  );
  log((pCard?.stats || []).length === 4, '时脉卡片含 4 项统计', `stats=${(pCard?.stats || []).map((s) => s.label).join('/')}`);
  const landPulse = await api('GET', `/share/${pCode}`);
  const pContent = D(landPulse)?.content;
  log(
    landPulse.status === 200 && pContent?.type === 'pulse' && (pContent?.stats || []).length === 4,
    '落地页还原时脉内容（引导注册）',
    `path=${pContent?.path}`,
  );

  // 未登录不可生成时脉分享
  const pulseNoAuth = await api('POST', '/share', { body: { type: 'pulse', targetId: 1 } });
  log(pulseNoAuth.status === 403, '未登录生成时脉分享被拒', `status=${pulseNoAuth.status}`);

  // ===== 5. 短码不可枚举 / 非法码 404 =====
  const guesses = ['1', '2', '100', '00000000', 'AAAAAAAA', 'admin', 'test'];
  let allMiss = true;
  for (const g of guesses) {
    const r = await api('GET', `/share/${g}`);
    if (r.status !== 404) allMiss = false;
  }
  log(allMiss, '自增ID/常见猜测短码均 404（不可枚举）', `guesses=${guesses.length}`);

  const tampered = `${pCode.slice(0, -1)}${pCode.slice(-1) === 'a' ? 'b' : 'a'}`;
  const tamperRes = await api('GET', `/share/${tampered}`);
  log(tamperRes.status === 404, '篡改签名的时脉短码被拒（防伪造）', `status=${tamperRes.status}`);

  const badType = await api('POST', '/share', { token: tokenU, body: { type: 'hack', targetId: 1 } });
  log(badType.status === 400, '非法分享类型被拒', `status=${badType.status}`);

  const missing = await api('POST', '/share', { token: tokenU, body: { type: 'review', targetId: 99999999 } });
  log(missing.status === 404, '不存在的分享对象返回 404', `status=${missing.status}`);

  // ===== 6. 短码随机性（多次生成互不相同） =====
  const codes = new Set();
  const moreBooks = bookList.slice(0, 3);
  for (const b of moreBooks) {
    const r = await api('POST', '/share', { token: tokenU, body: { type: 'book', targetId: Number(b.id) } });
    const c = D(r)?.code;
    if (c) codes.add(c);
  }
  log(codes.size === moreBooks.length, '多个分享短码互不相同', `codes=${[...codes].join(',')}`);
} catch (e) {
  fail += 1;
  console.error('SCRIPT ERROR:', e?.message || e);
} finally {
  await db.end();
}

console.log(`\n===== P2-05 验收结果：PASS ${pass} / FAIL ${fail} =====`);
process.exit(fail === 0 ? 0 : 1);