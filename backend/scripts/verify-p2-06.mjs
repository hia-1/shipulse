/**
 * P2-06（辅助页面）端到端验收脚本。
 *
 * 前置：后端以 NODE_ENV=dev 运行于 127.0.0.1:3000，MySQL 可用（库 shipulse）。
 * 用法：node scripts/verify-p2-06.mjs
 *
 * 覆盖验收点：
 *  四个辅助页面可达（协议/反馈/帮助/关于：路由与文件齐备）/
 *  意见反馈可提交入库 / 隐私政策包含最小化采集与注销说明
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(__dirname, '../../web-user/src');

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

  const phoneU = `138${rnd8()}`;
  const uUser = await loginOrRegister(phoneU, '反馈验收用户');
  const tokenU = uUser?.accessToken;
  log(!!tokenU, '前置：注册/登录用户', `phone=${phoneU}`);
  if (!tokenU) throw new Error('前置登录失败，请确认后端以 NODE_ENV=dev 启动（固定验证码 123456）');

  console.log('\n---------- P2-06 辅助页面 ----------');

  // ===== 1. 四个页面：文件与路由齐备 =====
  const pages = [
    ['协议-隐私政策', 'views/legal/LegalView.vue'],
    ['协议-用户协议', 'views/legal/LegalView.vue'],
    ['意见反馈', 'views/FeedbackView.vue'],
    ['帮助中心', 'views/HelpView.vue'],
    ['关于我们', 'views/AboutView.vue'],
  ];
  for (const [name, rel] of pages) {
    log(fs.existsSync(path.join(WEB, rel)), `页面文件存在：${name}`, rel);
  }
  const routerSrc = fs.readFileSync(path.join(WEB, 'router/index.ts'), 'utf8');
  for (const p of ['/privacy', '/terms', '/feedback', '/help', '/about']) {
    log(routerSrc.includes(`path: '${p}'`), `路由已注册：${p}`);
  }
  const homeSrc = fs.readFileSync(path.join(WEB, 'views/HomeView.vue'), 'utf8');
  for (const p of ['/privacy', '/terms', '/feedback', '/help', '/about']) {
    log(homeSrc.includes(`to="${p}"`), `首页页脚入口：${p}`);
  }

  // ===== 2. 隐私政策包含最小化采集与注销说明 =====
  const legalSrc = fs.readFileSync(path.join(WEB, 'views/legal/LegalView.vue'), 'utf8');
  log(legalSrc.includes('最小必要') || legalSrc.includes('最小化采集'), '隐私政策含最小化采集说明');
  log(legalSrc.includes('注销'), '隐私政策含注销说明');

  // ===== 3. 提交反馈入库 =====
  const content = `验收反馈_${Date.now()}：希望增加阅读日历导出功能。`;
  const submit = await api('POST', '/feedback', {
    token: tokenU,
    body: { type: 'suggestion', content, contact: '13800000000' },
  });
  const fbId = D(submit)?.id;
  log(
    (submit.status === 200 || submit.status === 201) && !!fbId,
    '提交反馈成功并返回 ID',
    `status=${submit.status} id=${fbId}`,
  );

  const [rows] = await db.query(
    'SELECT user_id, type, content, status, contact FROM feedback WHERE id = ?',
    [fbId],
  );
  const row = rows[0];
  log(!!row, '反馈已落库 feedback 表', `id=${fbId}`);
  log(row?.type === 'suggestion', '反馈类型正确入库', `type=${row?.type}`);
  log(row?.status === 'pending', '新反馈初始状态 pending', `status=${row?.status}`);
  log(row?.contact === '13800000000', '联系方式入库', `contact=${row?.contact}`);

  // ===== 4. 我的反馈记录 =====
  const mine = await api('GET', '/feedback/mine?page=1&size=10', { token: tokenU });
  const list = D(mine)?.list ?? [];
  log(
    mine.status === 200 && list.some((it) => it.id === fbId),
    '我的反馈列表含刚提交记录',
    `status=${mine.status} total=${D(mine)?.total}`,
  );

  // ===== 5. 校验与鉴权 =====
  const tooShort = await api('POST', '/feedback', { token: tokenU, body: { content: '短' } });
  log(tooShort.status === 400, '内容过短被拒（400）', `status=${tooShort.status}`);

  const noContent = await api('POST', '/feedback', { token: tokenU, body: { type: 'bug' } });
  log(noContent.status === 400, '缺少内容被拒（400）', `status=${noContent.status}`);

  const badType = await api('POST', '/feedback', {
    token: tokenU,
    body: { type: 'hack', content: '类型非法验收内容' },
  });
  log(badType.status === 400, '非法反馈类型被拒（400）', `status=${badType.status}`);

  const noAuth = await api('POST', '/feedback', { body: { content: '未登录提交验收内容' } });
  log(noAuth.status === 401 || noAuth.status === 403, '未登录提交被拒', `status=${noAuth.status}`);
} catch (e) {
  fail += 1;
  console.error('SCRIPT ERROR:', e?.message || e);
} finally {
  await db.end();
}

console.log(`\n===== P2-06 验收结果：PASS ${pass} / FAIL ${fail} =====`);
process.exit(fail === 0 ? 0 : 1);
