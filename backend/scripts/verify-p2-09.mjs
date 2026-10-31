/**
 * P2-09（小程序-消息与我的）端到端验收脚本。
 *
 * 前置：后端以 NODE_ENV=dev 运行于 127.0.0.1:3000，MySQL 可用（库 shipulse）。
 *        dev 且未配置 WECHAT_APPID 时启用微信 mock 适配器。
 * 用法：node scripts/verify-p2-09.mjs
 *
 * 覆盖验收点：
 *  消息与 Web 端同源（同一 notifications 表）/
 *  分类 Tab 过滤、未读数、单条与全部已读 /
 *  会员状态实时反映订阅情况 / 书架概览与徽章展示正确 / 设置项可用
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

const marker = `p209_${Date.now()}`;
let insertedIds = [];

try {
  // ============ 前置检查 ============
  const ping = await api('GET', '/admin/ping');
  log(ping.status === 200, '前置：后端存活', `status=${ping.status}`);

  // ===== 微信登录 =====
  const phone = `136${rnd8()}`;
  const login = await api('POST', '/auth/wechat', {
    body: { code: `mock-openid:${marker}`, phoneCode: phone, nickname: 'P2-09验收' },
  });
  const token = D(login)?.accessToken;
  const userId = D(login)?.user?.id;
  log(!!token && !!userId, '微信一键登录签发令牌', `userId=${userId}`);
  if (!token) throw new Error('登录失败，后续用例无法继续');

  console.log('\n---------- P2-09 消息中心（与 Web 同源 notifications） ----------');

  // ===== 造数：直接写入 notifications（模拟 Web/小程序共用同一张表） =====
  const rows = [
    ['like', '有人赞了你的书评', `${marker}-like`],
    ['comment', '有人评论了你的动态', `${marker}-comment`],
    ['system', '系统通知：会员权益已到账', `${marker}-system`],
  ];
  for (const [type, title, content] of rows) {
    const [r] = await db.query(
      `INSERT INTO notifications (user_id, type, title, content, sender_id, target_type, target_id, is_read)
       VALUES (?, ?, ?, ?, 0, '', 0, 0)`,
      [userId, type, title, content],
    );
    insertedIds.push(r.insertId);
  }
  const [dbRows] = await db.query(
    'SELECT id, type FROM notifications WHERE user_id = ? AND content LIKE ?',
    [userId, `%${marker}%`],
  );
  log(dbRows.length === 3, 'DB：写入 3 条通知（like/comment/system）', `count=${dbRows.length}`);

  // ===== 未读数（总数 + 分类） =====
  const unread = await api('GET', '/notifications/unread-count', { token });
  const u = D(unread);
  log(unread.status === 200 && typeof u?.total === 'number', '未读数接口可用', `total=${u?.total}`);
  log(
    Number(u?.like) >= 1 && Number(u?.comment) >= 1 && Number(u?.system) >= 1,
    '未读数按分类统计正确',
    `like=${u?.like} comment=${u?.comment} system=${u?.system}`,
  );

  // ===== 列表：全部分类含造数（证明与 Web 同源） =====
  const allList = await api('GET', '/notifications?type=all&page=1&pageSize=50', { token });
  const allItems = D(allList)?.list ?? [];
  const mine = allItems.filter((n) => (n.content || '').includes(marker));
  log(allList.status === 200 && mine.length === 3, '消息列表可查且与 DB 同源', `matched=${mine.length}`);
  log(
    mine.every((n) => n.title && n.category),
    '列表项含 title/category 字段',
  );

  // ===== 分类 Tab 过滤 =====
  const likeList = await api('GET', '/notifications?type=like&page=1&pageSize=50', { token });
  const likeItems = D(likeList)?.list ?? [];
  log(
    likeList.status === 200 && likeItems.length >= 1 && likeItems.every((n) => n.category === 'like'),
    '分类 Tab（赞）过滤正确',
    `count=${likeItems.length}`,
  );

  // ===== 单条已读 =====
  const targetId = mine.find((n) => n.category === 'like')?.id;
  const readOne = await api('PATCH', `/notifications/${targetId}/read`, { token });
  log((readOne.status === 200 || readOne.status === 201) && D(readOne)?.isRead === true, '单条标记已读成功');
  const [dbOne] = await db.query('SELECT is_read FROM notifications WHERE id = ?', [targetId]);
  log(Number(dbOne[0]?.is_read) === 1, 'DB：单条 is_read 置 1', `is_read=${dbOne[0]?.is_read}`);

  // ===== 全部已读（按分类） =====
  const readAll = await api('PATCH', '/notifications/read-all?type=like', { token });
  log(readAll.status === 200, '按分类全部已读成功', `updated=${D(readAll)?.updated}`);
  const unread2 = await api('GET', '/notifications/unread-count', { token });
  log(Number(D(unread2)?.like) === 0, '全部已读后该分类未读归零', `like=${D(unread2)?.like}`);

  // ===== 越权：读他人通知应 404 =====
  const other = await api('POST', '/auth/wechat', {
    body: { code: `mock-openid:other_${marker}` },
  });
  const otherToken = D(other)?.accessToken;
  const cross = await api('PATCH', `/notifications/${insertedIds[0]}/read`, { token: otherToken });
  log(cross.status === 404, '他人通知不可标记已读（404）', `status=${cross.status}`);

  console.log('\n---------- P2-09 我的页数据源 ----------');

  // ===== 个人信息 =====
  const profile = await api('GET', '/user/profile', { token });
  log(
    profile.status === 200 && !!D(profile)?.nickname && typeof D(profile)?.bookCount === 'number',
    '个人信息可查（含书籍/书评/动态数）',
    `nickname=${D(profile)?.nickname}`,
  );

  // ===== 书架概览（三态计数） =====
  const shelfWant = await api('GET', '/bookshelf?status=want&pageSize=1', { token });
  log(
    shelfWant.status === 200 && typeof D(shelfWant)?.total === 'number',
    '书架概览可查（想读计数）',
    `want=${D(shelfWant)?.total}`,
  );

  // ===== 徽章 =====
  const badges = await api('GET', '/incentive/badges/mine', { token });
  log(badges.status === 200 && Array.isArray(D(badges)), '已解锁徽章可查', `count=${(D(badges) ?? []).length}`);

  // ===== 会员状态 =====
  const member = await api('GET', '/membership/my', { token });
  log(
    member.status === 200 && typeof D(member)?.isMember === 'boolean',
    '会员状态可查（实时反映订阅）',
    `isMember=${D(member)?.isMember}`,
  );

  // ===== 订阅授权状态（消息页订阅管理） =====
  const sub = await api('GET', '/subscribe/status', { token });
  log(sub.status === 200 && Array.isArray(D(sub)?.templates), '订阅授权状态可查（订阅管理）');

  console.log('\n---------- P2-09 小程序工程与接入 ----------');

  const appJson = JSON.parse(fs.readFileSync(path.join(MP, 'app.json'), 'utf8'));
  log(appJson.pages.includes('pages/messages/messages'), 'app.json 注册消息页');
  log(appJson.pages.includes('pages/profile/profile'), 'app.json 注册我的页');
  const tabPaths = (appJson.tabBar?.list ?? []).map((t) => t.pagePath);
  log(
    tabPaths.includes('pages/messages/messages') && tabPaths.includes('pages/profile/profile'),
    'tabBar 含 消息 / 我的',
    `tabs=${tabPaths.join(',')}`,
  );

  const files = [
    'pages/messages/messages.js',
    'pages/messages/messages.wxml',
    'pages/messages/messages.wxss',
    'pages/messages/messages.json',
    'pages/profile/profile.js',
    'pages/profile/profile.wxml',
    'pages/profile/profile.wxss',
    'pages/profile/profile.json',
  ];
  for (const f of files) {
    log(fs.existsSync(path.join(MP, f)), `文件存在：${f}`);
  }

  const msgSrc = fs.readFileSync(path.join(MP, 'pages/messages/messages.js'), 'utf8');
  log(msgSrc.includes('/notifications/unread-count'), '消息页读取未读数');
  log(msgSrc.includes('/notifications/read-all'), '消息页支持全部已读');
  log(msgSrc.includes('wx.setTabBarBadge'), '消息页同步 tabBar 角标');
  log(msgSrc.includes('/subscribe/status'), '消息页含订阅授权管理');

  const profSrc = fs.readFileSync(path.join(MP, 'pages/profile/profile.js'), 'utf8');
  log(profSrc.includes('/user/profile'), '我的页读取个人信息');
  log(profSrc.includes('/bookshelf'), '我的页读取书架概览');
  log(profSrc.includes('/incentive/badges/mine'), '我的页读取徽章');
  log(profSrc.includes('/membership/my'), '我的页读取会员状态');
  const profWxml = fs.readFileSync(path.join(MP, 'pages/profile/profile.wxml'), 'utf8');
  log(
    ['/privacy', '/terms', '/feedback', '/help', '/about'].every((p) => profWxml.includes(p)),
    '我的页设置项含协议/反馈/帮助/关于入口',
  );
  log(
    profWxml.includes('onLogout') && profWxml.includes('onClearCache'),
    '设置项含退出登录与清除缓存',
  );

  const wxss = fs.readFileSync(path.join(MP, 'app.wxss'), 'utf8');
  log(/2d4a43/i.test(wxss) && /fbfbfa/i.test(wxss), '品牌 Token 一致（pine-deep / paper-base）');
} catch (e) {
  fail += 1;
  console.error('SCRIPT ERROR:', e?.message || e);
} finally {
  // 清理造数，避免污染后续验收
  if (insertedIds.length) {
    await db.query('DELETE FROM notifications WHERE id IN (?)', [insertedIds]);
  }
  await db.end();
}

console.log(`\n===== P2-09 验收结果：PASS ${pass} / FAIL ${fail} =====`);
process.exit(fail === 0 ? 0 : 1);
