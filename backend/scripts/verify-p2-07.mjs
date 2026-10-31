/**
 * P2-07（小程序-地基登录与查书）端到端验收脚本。
 *
 * 前置：后端以 NODE_ENV=dev 运行于 127.0.0.1:3000，MySQL 可用（库 shipulse）。
 *        dev 且未配置 WECHAT_APPID 时启用微信 mock 适配器：
 *          - code 形如 `mock-openid:XXX` → openid = XXX
 *          - phoneCode 直接视为手机号（需为合法 11 位手机号）
 * 用法：node scripts/verify-p2-07.mjs
 *
 * 覆盖验收点：
 *  微信登录可用 / 与 Web 同手机号账号合并为同一用户 /
 *  查书（列表·详情·联想·ISBN）可用 / 书架三态可用 /
 *  小程序「去 Web 站」引导可见 / 品牌 Token 一致
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MP = path.resolve(__dirname, '../../miniprogram');

const BASE = 'http://127.0.0.1:3000/api';
let pass = 0;
let fail = 0;

function log(ok, name, detail = '') {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`);
}

async function api(method, pathname, { body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${pathname}`, {
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

const D = (r) => (r.body && typeof r.body === 'object' && 'data' in r.body ? r.body.data : r.body);
const rnd8 = () => String(Math.floor(10000000 + Math.random() * 89999999));

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

  console.log('\n---------- P2-07 微信一键登录 ----------');

  // ===== 1. 首次微信登录（未绑定手机号） =====
  const openidA = `verify_openid_a_${Date.now()}`;
  const codeA = `mock-openid:${openidA}`;
  const wx1 = await api('POST', '/auth/wechat', { body: { code: codeA } });
  const u1 = D(wx1);
  log(
    (wx1.status === 200 || wx1.status === 201) && !!u1?.accessToken,
    '首次微信登录签发令牌',
    `status=${wx1.status}`,
  );
  log(!!u1?.user?.id, '微信登录返回用户', `userId=${u1?.user?.id}`);

  // 幂等：同一 openid 再次登录应命中同一账号
  const wx2 = await api('POST', '/auth/wechat', { body: { code: codeA } });
  log(D(wx2)?.user?.id === u1?.user?.id, '同一微信身份重复登录命中同一账号');

  // 微信身份已入库
  const [wxRows] = await db.query(
    "SELECT id FROM user_auths WHERE user_id = ? AND identity_type = 'wechat' AND identifier = ?",
    [u1?.user?.id, openidA],
  );
  log(wxRows.length === 1, 'user_auths 写入微信身份', `openid=${openidA}`);

  // 令牌可用于受保护接口
  const prof = await api('GET', '/user/profile', { token: u1?.accessToken });
  log(prof.status === 200 && D(prof)?.id === u1?.user?.id, '微信令牌可访问受保护接口');

  console.log('\n---------- P2-07 手机号绑定与账号合并 ----------');

  // ===== 2. 与 Web 同手机号账号合并 =====
  const phone = `139${rnd8()}`;
  const reg = await api('POST', '/auth/register', {
    body: { phone, code: '123456', nickname: 'Web 验收用户' },
  });
  const webUser = D(reg);
  log(
    (reg.status === 200 || reg.status === 201) && !!webUser?.accessToken,
    '前置：Web 端手机号注册成功',
    `phone=${phone} userId=${webUser?.user?.id}`,
  );

  const openidB = `verify_openid_b_${Date.now()}`;
  const wx3 = await api('POST', '/auth/wechat', {
    body: { code: `mock-openid:${openidB}`, phoneCode: phone },
  });
  const u3 = D(wx3);
  log(
    u3?.user?.id === webUser?.user?.id,
    '微信登录（带手机号）与 Web 账号合并为同一用户',
    `wechatUserId=${u3?.user?.id} webUserId=${webUser?.user?.id}`,
  );
  log(u3?.user?.phone === phone, '合并后手机号为统一标识', `phone=${u3?.user?.phone}`);

  // 同一手机号不应产生第二个用户
  const [userCount] = await db.query('SELECT COUNT(*) AS c FROM users WHERE phone = ?', [phone]);
  log(Number(userCount[0]?.c) === 1, '同手机号未产生重复用户', `count=${userCount[0]?.c}`);

  // 该用户同时拥有 phone 与 wechat 两种身份
  const [authRows] = await db.query(
    'SELECT identity_type FROM user_auths WHERE user_id = ?',
    [webUser?.user?.id],
  );
  const types = authRows.map((r) => r.identity_type).sort();
  log(
    types.includes('phone') && types.includes('wechat'),
    '账号同时绑定手机号与微信身份',
    `types=${types.join(',')}`,
  );

  // 再次微信登录（不带手机号）仍为同一账号
  const wx4 = await api('POST', '/auth/wechat', { body: { code: `mock-openid:${openidB}` } });
  log(D(wx4)?.user?.id === webUser?.user?.id, '已绑定微信再次登录命中同一账号');

  // ===== 3. 参数校验 =====
  const noCode = await api('POST', '/auth/wechat', { body: {} });
  log(noCode.status === 400, '缺少 code 被拒（400）', `status=${noCode.status}`);

  console.log('\n---------- P2-07 查书 ----------');

  // ===== 4. 书库列表 / 详情 / 联想 / ISBN =====
  const list = await api('GET', '/library/books?page=1&pageSize=5');
  const books = D(list)?.list ?? [];
  log(list.status === 200 && books.length > 0, '书籍列表可查', `total=${D(list)?.total}`);
  const first = books[0];

  const detail = await api('GET', `/library/books/${first?.id}`);
  log(detail.status === 200 && !!D(detail)?.title, '书籍详情可查', `title=${D(detail)?.title}`);

  const kw = (first?.title || '').slice(0, 2);
  const suggest = await api('GET', `/search/suggest?keyword=${encodeURIComponent(kw)}&limit=8`);
  log(
    suggest.status === 200 && Array.isArray(D(suggest)?.books),
    '搜索联想可查',
    `keyword=${kw} books=${(D(suggest)?.books ?? []).length}`,
  );

  const isbnBook = books.find((b) => b.isbn);
  if (isbnBook) {
    const byIsbn = await api('GET', `/library/books/isbn/${isbnBook.isbn}`);
    log(byIsbn.status === 200 && !!D(byIsbn), 'ISBN 精确查可查', `isbn=${isbnBook.isbn}`);
  } else {
    log(true, 'ISBN 精确查（本页无带 ISBN 书籍，跳过）');
  }

  console.log('\n---------- P2-07 书架三态（微信令牌） ----------');

  // ===== 5. 书架三态（使用微信登录令牌） =====
  const token = u3?.accessToken;
  const bookId = first?.id;
  const put = await api('PUT', `/bookshelf/${bookId}`, {
    token,
    body: { status: 'reading' },
  });
  log(put.status === 200, '加入书架（在读）成功', `status=${put.status}`);

  const st = await api('GET', `/bookshelf/status/${bookId}`, { token });
  log(D(st)?.status === 'reading', '书架状态查询为「在读」', `status=${D(st)?.status}`);

  const shelf = await api('GET', '/bookshelf?status=reading&pageSize=20', { token });
  const inShelf = (D(shelf)?.list ?? []).some((it) => it.bookId === bookId);
  log(inShelf, '在读列表包含该书');

  console.log('\n---------- P2-07 首页快捷打卡 ----------');
  const today = await api('GET', '/posts/today', { token });
  log(
    today.status === 200 && typeof D(today)?.checkedToday === 'boolean',
    '今日打卡状态可查',
    `checkedToday=${D(today)?.checkedToday}`,
  );

  const checkin = await api('POST', '/posts/checkin', {
    token,
    body: { bookId, readMinutes: 15 },
  });
  log(
    checkin.status === 200 || checkin.status === 201,
    '快捷打卡成功',
    `status=${checkin.status}`,
  );

  const del = await api('DELETE', `/bookshelf/${bookId}`, { token });
  log(del.status === 200, '移出书架成功', `status=${del.status}`);

  console.log('\n---------- P2-07 小程序工程与品牌 Token ----------');

  // ===== 6. 小程序页面与文件齐备 =====
  const appJson = JSON.parse(fs.readFileSync(path.join(MP, 'app.json'), 'utf8'));
  for (const p of ['pages/index/index', 'pages/search/search', 'pages/book/book']) {
    log(appJson.pages.includes(p), `app.json 注册页面：${p}`);
  }
  const files = [
    'app.js',
    'app.wxss',
    'config.js',
    'utils/store.js',
    'utils/request.js',
    'utils/auth.js',
    'utils/format.js',
    'pages/index/index.wxml',
    'pages/index/index.js',
    'pages/search/search.wxml',
    'pages/search/search.js',
    'pages/book/book.wxml',
    'pages/book/book.js',
  ];
  for (const f of files) {
    log(fs.existsSync(path.join(MP, f)), `文件存在：${f}`);
  }

  // ===== 7. 请求封装：令牌附带 + 401 刷新 =====
  const reqSrc = fs.readFileSync(path.join(MP, 'utils/request.js'), 'utf8');
  log(reqSrc.includes('Authorization'), '请求封装附带 Bearer 令牌');
  log(reqSrc.includes('/auth/refresh'), '请求封装含 401 自动刷新');

  // ===== 8. 去 Web 站引导 + 品牌 Token =====
  const bookWxml = fs.readFileSync(path.join(MP, 'pages/book/book.wxml'), 'utf8');
  log(bookWxml.includes('Web 站'), '书籍详情页含「去 Web 站」引导');
  const cfg = fs.readFileSync(path.join(MP, 'config.js'), 'utf8');
  log(cfg.includes('WEB_BASE'), '配置含 Web 站地址');
  const wxss = fs.readFileSync(path.join(MP, 'app.wxss'), 'utf8');
  log(
    /#2d4a43/i.test(wxss) && /#fbfbfa/i.test(wxss),
    '品牌 Token 一致（pine-deep / paper-base）',
  );
} catch (e) {
  fail += 1;
  console.error('SCRIPT ERROR:', e?.message || e);
} finally {
  await db.end();
}

console.log(`\n===== P2-07 验收结果：PASS ${pass} / FAIL ${fail} =====`);
process.exit(fail === 0 ? 0 : 1);
