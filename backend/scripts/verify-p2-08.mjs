/**
 * P2-08（小程序-阅读计时与时脉简版）端到端验收脚本。
 *
 * 前置：后端以 NODE_ENV=dev 运行于 127.0.0.1:3000，MySQL 可用（库 shipulse）。
 *        dev 且未配置 WECHAT_APPID 时启用微信 mock 适配器：
 *          - code 形如 `mock-openid:XXX` → openid = XXX
 *          - phoneCode 直接视为手机号（需为合法 11 位手机号）
 *        未配置 WECHAT_TEMPLATE_IDS 时订阅模板回退为 DEV 占位模板，下发走 mock。
 * 用法：node scripts/verify-p2-08.mjs
 *
 * 覆盖验收点：
 *  阅读计时与 Web 端同账号互通（同一 reading_sessions）/
 *  进行中场次可恢复 / 重复开始自动结束上一场次 /
 *  时脉今日·本周·按日聚合与打卡日历数据源可用 / 分享卡片可生成 /
 *  订阅消息模板查询·授权额度累加·下发扣减·未授权拦截
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

async function wechatLogin(tag) {
  const phone = `137${rnd8()}`;
  const code = `mock-openid:verify_p208_${tag}_${Date.now()}`;
  const r = await api('POST', '/auth/wechat', {
    body: { code, phoneCode: phone, nickname: `P2-08验收-${tag}` },
  });
  return { status: r.status, token: D(r)?.accessToken, userId: D(r)?.user?.id, phone };
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

  console.log('\n---------- P2-08 订阅消息：模板与授权额度 ----------');

  // ===== 1. 订阅模板（公开） =====
  const tpl = await api('GET', '/subscribe/templates');
  const templates = Array.isArray(D(tpl)) ? D(tpl) : [];
  log(tpl.status === 200 && templates.length > 0, '订阅模板可查（公开）', `count=${templates.length}`);
  log(
    templates.every((t) => t.id && t.key && t.title),
    '模板字段完整（id/key/title）',
  );
  const templateId = templates[0]?.id;

  // ===== 2. 微信登录 =====
  const login = await wechatLogin('main');
  const token = login.token;
  log(!!token, '微信一键登录签发令牌', `userId=${login.userId}`);
  if (!token) throw new Error('登录失败，后续用例无法继续');

  // ===== 3. 授权前额度为 0 =====
  const st0 = await api('GET', '/subscribe/status', { token });
  const row0 = (D(st0)?.templates ?? []).find((t) => t.id === templateId);
  log(st0.status === 200, '订阅状态可查（含 mock 标识）', `mock=${D(st0)?.mock}`);
  log(Number(row0?.remaining) === 0 && row0?.authorized === false, '新用户初始额度为 0', `remaining=${row0?.remaining}`);

  // ===== 4. 授权上报 → 额度累加 =====
  const az1 = await api('POST', '/subscribe/authorize', { token, body: { templateIds: [templateId] } });
  log(az1.status === 200 || az1.status === 201, '授权上报成功', `status=${az1.status}`);
  const st1 = await api('GET', '/subscribe/status', { token });
  const row1 = (D(st1)?.templates ?? []).find((t) => t.id === templateId);
  log(Number(row1?.remaining) === 1 && row1?.authorized === true, '授权后额度 +1', `remaining=${row1?.remaining}`);

  const [azRows1] = await db.query(
    'SELECT count FROM subscribe_authorizations WHERE user_id = ? AND template_id = ?',
    [login.userId, templateId],
  );
  log(azRows1.length === 1 && Number(azRows1[0].count) === 1, 'DB：授权记录写入且 count=1', `count=${azRows1[0]?.count}`);

  // ===== 5. 再次授权累加（一次性订阅可累加） =====
  await api('POST', '/subscribe/authorize', { token, body: { templateIds: [templateId] } });
  const st2 = await api('GET', '/subscribe/status', { token });
  const row2 = (D(st2)?.templates ?? []).find((t) => t.id === templateId);
  log(Number(row2?.remaining) === 2, '再次授权额度累加为 2', `remaining=${row2?.remaining}`);

  // ===== 6. 下发订阅消息 → 扣减额度 =====
  const send = await api('POST', '/subscribe/send', {
    token,
    body: { templateId, page: 'pages/pulse/pulse' },
  });
  log(
    (send.status === 200 || send.status === 201) && D(send)?.sent === true && D(send)?.remaining === 1,
    '订阅消息下发成功并扣减额度（mock）',
    `sent=${D(send)?.sent} remaining=${D(send)?.remaining}`,
  );
  const [azRows2] = await db.query(
    'SELECT count FROM subscribe_authorizations WHERE user_id = ? AND template_id = ?',
    [login.userId, templateId],
  );
  log(Number(azRows2[0]?.count) === 1, 'DB：下发后 count 扣减为 1', `count=${azRows2[0]?.count}`);

  // ===== 7. 未知模板被拒 =====
  const badTpl = await api('POST', '/subscribe/authorize', {
    token,
    body: { templateIds: ['NOT_A_TEMPLATE'] },
  });
  log(badTpl.status === 400, '未知订阅模板被拒（400）', `status=${badTpl.status}`);

  // ===== 8. 未授权用户下发被拒 =====
  const fresh = await wechatLogin('noauth');
  const sendNoAuth = await api('POST', '/subscribe/send', {
    token: fresh.token,
    body: { templateId },
  });
  log(sendNoAuth.status === 400, '未授权用户下发被拒（400）', `status=${sendNoAuth.status}`);

  // ===== 9. DTO 校验：缺少 templateId =====
  const badBody = await api('POST', '/subscribe/send', { token, body: {} });
  log(badBody.status === 400, '下发缺少 templateId 被拒（400）', `status=${badBody.status}`);

  console.log('\n---------- P2-08 阅读计时（与 Web 端同账号互通） ----------');

  // ===== 10. 取两本上架书籍 =====
  const list = await api('GET', '/library/books?page=1&pageSize=2');
  const books = D(list)?.list ?? [];
  log(books.length >= 1, '可获取上架书籍', `count=${books.length}`);
  const bookA = books[0];
  const bookB = books[1] ?? books[0];

  // ===== 11. 开始阅读场次（小程序来源） =====
  const s1 = await api('POST', '/reading/sessions', {
    token,
    body: { bookId: Number(bookA?.id), startPage: 1, source: 'miniprogram' },
  });
  const sid1 = D(s1)?.sessionId;
  log((s1.status === 200 || s1.status === 201) && !!sid1, '开始阅读场次成功', `sessionId=${sid1}`);
  const [rs1] = await db.query('SELECT status, source FROM reading_sessions WHERE id = ?', [sid1]);
  log(
    rs1.length === 1 && rs1[0].status === 'ongoing' && rs1[0].source === 'miniprogram',
    'DB：场次写入 ongoing 且来源为 miniprogram',
    `status=${rs1[0]?.status} source=${rs1[0]?.source}`,
  );

  // ===== 12. 进行中恢复（小程序重进页面续接，同账号互通） =====
  const ongoing = await api('GET', '/reading/sessions/ongoing', { token });
  log(D(ongoing)?.sessionId === sid1, '进行中场次可恢复且与开始时一致', `ongoing=${D(ongoing)?.sessionId}`);

  // ===== 13. 重复开始 → 自动结束上一场次 =====
  const s2 = await api('POST', '/reading/sessions', {
    token,
    body: { bookId: Number(bookB?.id), startPage: 1, source: 'miniprogram' },
  });
  const sid2 = D(s2)?.sessionId;
  const [rs1b] = await db.query('SELECT status FROM reading_sessions WHERE id = ?', [sid1]);
  log(
    !!sid2 && sid2 !== sid1 && rs1b[0]?.status === 'finished',
    '重复开始自动结束上一场次',
    `oldStatus=${rs1b[0]?.status} newSession=${sid2}`,
  );

  // ===== 14. 结束场次（页码 + 笔记） =====
  const fin = await api('PATCH', `/reading/sessions/${sid2}/finish`, {
    token,
    body: { endPage: 12, note: 'P2-08 验收笔记', durationSeconds: 90 },
  });
  log(
    (fin.status === 200 || fin.status === 201) &&
      D(fin)?.status === 'finished' &&
      D(fin)?.endPage === 12,
    '结束阅读场次成功（页码/笔记落库）',
    `status=${D(fin)?.status} endPage=${D(fin)?.endPage}`,
  );
  const [rs2] = await db.query(
    'SELECT status, end_page, note, duration_seconds FROM reading_sessions WHERE id = ?',
    [sid2],
  );
  log(
    rs2[0]?.status === 'finished' &&
      Number(rs2[0]?.end_page) === 12 &&
      rs2[0]?.note === 'P2-08 验收笔记',
    'DB：结束时页码/笔记/时长落库',
    `endPage=${rs2[0]?.end_page} note=${rs2[0]?.note} dur=${rs2[0]?.duration_seconds}`,
  );

  // ===== 15. 已结束场次不可重复结束 =====
  const finAgain = await api('PATCH', `/reading/sessions/${sid2}/finish`, {
    token,
    body: { endPage: 20 },
  });
  log(finAgain.status === 404, '已结束场次不可重复结束（404）', `status=${finAgain.status}`);

  console.log('\n---------- P2-08 时脉简版数据源 ----------');

  // ===== 16. 今日概览 =====
  const today = await api('GET', '/reading/sessions/today-summary', { token });
  log(
    today.status === 200 && typeof D(today)?.totalSeconds === 'number',
    '今日概览可查',
    `totalSeconds=${D(today)?.totalSeconds} sessions=${D(today)?.sessionCount}`,
  );

  // ===== 17. 按日聚合（打卡日历/周柱状图数据源） =====
  const daily = await api('GET', '/reading/pulse/daily', { token });
  const dailyList = Array.isArray(D(daily)) ? D(daily) : [];
  log(daily.status === 200 && dailyList.length >= 1, '按日聚合返回记录', `days=${dailyList.length}`);
  log(
    dailyList.every((d) => typeof d.date === 'string' && typeof d.seconds === 'number'),
    '按日记录字段完整（date/seconds）',
  );

  // ===== 18. 年度盘点 =====
  const annual = await api('GET', '/reading/pulse/annual', { token });
  log(
    annual.status === 200 && typeof D(annual)?.totalSeconds === 'number',
    '年度盘点可查',
    `totalSeconds=${D(annual)?.totalSeconds}`,
  );

  // ===== 19. 分享卡片（时脉） =====
  const share = await api('POST', '/share', {
    token,
    body: { type: 'pulse', targetId: login.userId },
  });
  log(
    (share.status === 200 || share.status === 201) && !!D(share)?.code,
    '时脉分享卡片可生成（含短码）',
    `code=${D(share)?.code}`,
  );

  console.log('\n---------- P2-08 小程序工程与接入 ----------');

  // ===== 20. 页面注册 =====
  const appJson = JSON.parse(fs.readFileSync(path.join(MP, 'app.json'), 'utf8'));
  log(appJson.pages.includes('pages/reading/reading'), 'app.json 注册阅读计时页');
  log(appJson.pages.includes('pages/pulse/pulse'), 'app.json 注册时脉简版页');
  const tabPaths = (appJson.tabBar?.list ?? []).map((t) => t.pagePath);
  log(
    tabPaths.includes('pages/index/index') && tabPaths.includes('pages/pulse/pulse'),
    'tabBar 含 首页 / 时脉 双底栏',
    `tabs=${tabPaths.join(',')}`,
  );

  // ===== 21. 文件齐备 =====
  const files = [
    'pages/reading/reading.js',
    'pages/reading/reading.wxml',
    'pages/reading/reading.wxss',
    'pages/reading/reading.json',
    'pages/pulse/pulse.js',
    'pages/pulse/pulse.wxml',
    'pages/pulse/pulse.wxss',
    'pages/pulse/pulse.json',
    'utils/subscribe.js',
  ];
  for (const f of files) {
    log(fs.existsSync(path.join(MP, f)), `文件存在：${f}`);
  }

  // ===== 22. 接口接入与交互约束 =====
  const readingSrc = fs.readFileSync(path.join(MP, 'pages/reading/reading.js'), 'utf8');
  log(readingSrc.includes('/reading/sessions'), '计时页调用阅读场次接口');
  log(readingSrc.includes('/reading/sessions/ongoing'), '计时页支持进行中恢复');
  log(readingSrc.includes('source: \'miniprogram\''), '计时页标记来源 miniprogram');

  const pulseSrc = fs.readFileSync(path.join(MP, 'pages/pulse/pulse.js'), 'utf8');
  log(pulseSrc.includes('/reading/pulse/daily'), '时脉页调用按日聚合接口');
  log(pulseSrc.includes('/reading/sessions/today-summary'), '时脉页调用今日概览接口');
  log(pulseSrc.includes("type: 'pulse'"), '时脉页可生成时脉分享卡片');

  const subSrc = fs.readFileSync(path.join(MP, 'utils/subscribe.js'), 'utf8');
  log(subSrc.includes('wx.requestSubscribeMessage'), '订阅工具使用 wx.requestSubscribeMessage');
  log(subSrc.includes('/subscribe/authorize'), '订阅工具上报授权额度');

  // ===== 23. 品牌 Token 一致 =====
  const wxss = fs.readFileSync(path.join(MP, 'app.wxss'), 'utf8');
  log(/2d4a43/i.test(wxss) && /fbfbfa/i.test(wxss), '品牌 Token 一致（pine-deep / paper-base）');
} catch (e) {
  fail += 1;
  console.error('SCRIPT ERROR:', e?.message || e);
} finally {
  await db.end();
}

console.log(`\n===== P2-08 验收结果：PASS ${pass} / FAIL ${fail} =====`);
process.exit(fail === 0 ? 0 : 1);
