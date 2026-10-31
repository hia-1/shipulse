/**
 * P2-12（内容审核与举报申诉）/ P2-15（活动共读营与系统设置）端到端验收脚本。
 *
 * 前置：后端以 NODE_ENV=dev 运行于 127.0.0.1:3000，MySQL 可用（库 shipulse）。
 * 用法：node scripts/verify-p2-12-15.mjs
 *
 * 覆盖验收点：
 *  P2-12  可疑内容不对外展示 / 阶梯处罚累犯升级 / 申诉可提交可改判 / moderation_logs 留痕
 *  P2-15  活动状态机（创建→报名→进行→结束）/ 报名计数准确 / 权限变更即时生效 / operation_logs 可查
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

  const adminLogin = await api('POST', '/admin/login', {
    body: { username: 'admin', password: 'admin123' },
  });
  const adminToken = D(adminLogin)?.accessToken;
  log(adminLogin.status === 201 && !!adminToken, '前置：管理员登录', `status=${adminLogin.status}`);

  const phoneA = `139${rnd8()}`;
  const phoneB = `139${rnd8()}`;
  const phoneC = `139${rnd8()}`;
  const uA = await loginOrRegister(phoneA, '验收用户A');
  const uB = await loginOrRegister(phoneB, '验收用户B');
  const uC = await loginOrRegister(phoneC, '验收用户C');
  const tokenA = uA?.accessToken;
  const tokenB = uB?.accessToken;
  const tokenC = uC?.accessToken;
  const idA = uA?.user?.id;
  log(!!tokenA && !!tokenB && !!tokenC, '前置：注册/登录三个用户', `A=${phoneA}(${idA}) B=${phoneB} C=${phoneC}`);
  if (!adminToken || !tokenA || !tokenB || !tokenC) {
    throw new Error('前置登录失败，请确认后端以 NODE_ENV=dev 启动（固定验证码 123456）');
  }

  const books = await api('GET', '/library/books?page=1&pageSize=1');
  const bookId = D(books)?.list?.[0]?.id;
  log(!!bookId, '前置：取一本书用于发评', `bookId=${bookId}`);
  if (!bookId) throw new Error('书库为空，无法继续验收');

  // ==================== P2-12 ====================
  console.log('\n---------- P2-12 内容审核与举报申诉 ----------');

  const rvTitle = `验收书评_${Date.now()}`;
  const createReview = await api('POST', '/community/reviews', {
    token: tokenA,
    body: {
      bookId,
      rating: 4.5,
      title: rvTitle,
      content: '这是一条用于验收举报与申诉闭环的书评内容。',
    },
  });
  const myReviews = await api('GET', '/community/reviews/my?page=1&pageSize=1', { token: tokenA });
  const reviewId = D(myReviews)?.list?.[0]?.id;
  log(
    (createReview.status === 200 || createReview.status === 201) && !!reviewId,
    'P2-12 用户A发布书评（机审通过即发布）',
    `status=${createReview.status} reviewId=${reviewId}`,
  );

  const detailBefore = await api('GET', `/community/reviews/${reviewId}`);
  log(detailBefore.status === 200, 'P2-12 违规前书评对外可见', `status=${detailBefore.status}`);

  const report = await api('POST', '/community/reports', {
    token: tokenB,
    body: {
      targetType: 'review',
      targetId: String(reviewId),
      reason: 'spam',
      description: '验收：疑似垃圾内容',
    },
  });
  log(report.status === 201, 'P2-12 用户B提交举报', `status=${report.status}`);

  const dupReport = await api('POST', '/community/reports', {
    token: tokenB,
    body: { targetType: 'review', targetId: String(reviewId), reason: 'spam' },
  });
  log(dupReport.status === 409, 'P2-12 重复举报被拒（去重）', `status=${dupReport.status}`);

  const selfReport = await api('POST', '/community/reports', {
    token: tokenA,
    body: { targetType: 'review', targetId: String(reviewId), reason: 'spam' },
  });
  log(selfReport.status === 400, 'P2-12 不能举报自己的内容', `status=${selfReport.status}`);

  const listReports = await api('GET', '/admin/reports?status=pending&size=50', { token: adminToken });
  const pending = D(listReports)?.items?.find((x) => String(x.targetId) === String(reviewId));
  log(!!pending, 'P2-12 管理端举报队列可见', `reportId=${pending?.id}`);

  const handle = await api('PATCH', `/admin/reports/${pending.id}`, {
    token: adminToken,
    body: { action: 'resolve', punishLevel: 'auto' },
  });
  const punishLevel = D(handle)?.punishLevel;
  log(
    handle.status === 200 && punishLevel === 'delete',
    'P2-12 阶梯处罚首犯=删除并告知',
    `status=${handle.status} punishLevel=${punishLevel}`,
  );

  const detailAfterPunish = await api('GET', `/community/reviews/${reviewId}`);
  log(
    detailAfterPunish.status === 404,
    'P2-12 处罚后违规内容不对外展示',
    `status=${detailAfterPunish.status}`,
  );

  const appeal = await api('POST', '/community/appeals', {
    token: tokenA,
    body: { targetType: 'review', targetId: String(reviewId), reason: '内容并未违规，申请人工复核' },
  });
  log(appeal.status === 201, 'P2-12 用户A提交申诉', `status=${appeal.status}`);

  const noLogAppeal = await api('POST', '/community/appeals', {
    token: tokenB,
    body: { targetType: 'review', targetId: '999999999', reason: '无处罚记录' },
  });
  log(noLogAppeal.status === 400, 'P2-12 无处罚记录不可申诉', `status=${noLogAppeal.status}`);

  const listAppeals = await api('GET', '/admin/appeals?status=pending&size=50', { token: adminToken });
  const pendAppeal = D(listAppeals)?.items?.find(
    (x) => String(x.targetId) === String(reviewId) && String(x.userId) === String(idA),
  );
  log(!!pendAppeal, 'P2-12 管理端申诉队列可见', `appealId=${pendAppeal?.id}`);

  const reviewAppeal = await api('PATCH', `/admin/appeals/${pendAppeal.id}`, {
    token: adminToken,
    body: { action: 'approve', result: '申诉成立，撤销处罚并恢复内容' },
  });
  log(reviewAppeal.status === 200 && D(reviewAppeal)?.status === 'approved', 'P2-12 申诉复核通过（改判）', `status=${reviewAppeal.status}`);

  const detailRestored = await api('GET', `/community/reviews/${reviewId}`);
  log(detailRestored.status === 200, 'P2-12 改判后内容恢复展示', `status=${detailRestored.status}`);

  // 留痕：moderation_logs
  const [logs] = await db.query(
    `SELECT action, target_type, target_id FROM moderation_logs
      WHERE (target_type='review' AND target_id=?) OR (target_type='user' AND target_id=?)
      ORDER BY id ASC`,
    [String(reviewId), String(idA)],
  );
  const actions = logs.map((l) => `${l.target_type}:${l.action}`);
  log(
    actions.includes('review:delete') && actions.includes('user:warn') && actions.includes('review:appeal_pass'),
    'P2-12 moderation_logs 全程留痕',
    actions.join(',') || '(空)',
  );

  // 阶梯升级：用户A再犯一次 → 应为 mute（此前已有 1 次 warn）
  const rv2 = await api('POST', '/community/reviews', {
    token: tokenA,
    body: { bookId, rating: 3, title: `验收书评二_${Date.now()}`, content: '第二条用于验证累犯升级。' },
  });
  const myReviews2 = await api('GET', '/community/reviews/my?page=1&pageSize=1', { token: tokenA });
  const reviewId2 = D(myReviews2)?.list?.[0]?.id;
  const report2 = await api('POST', '/community/reports', {
    token: tokenB,
    body: { targetType: 'review', targetId: String(reviewId2), reason: 'abuse' },
  });
  const listReports2 = await api('GET', '/admin/reports?status=pending&size=50', { token: adminToken });
  const pending2 = D(listReports2)?.items?.find((x) => String(x.targetId) === String(reviewId2));
  const handle2 = await api('PATCH', `/admin/reports/${pending2.id}`, {
    token: adminToken,
    body: { action: 'resolve', punishLevel: 'auto' },
  });
  log(
    handle2.status === 200 && D(handle2)?.punishLevel === 'mute',
    'P2-12 阶梯处罚累犯升级（二次=禁言7天）',
    `punishLevel=${D(handle2)?.punishLevel}`,
  );
  const [muteRows] = await db.query(
    `SELECT status, muted_until FROM users WHERE id=?`,
    [String(idA)],
  );
  log(
    muteRows[0]?.status === 'muted' && !!muteRows[0]?.muted_until,
    'P2-12 禁言状态与到期时间已落库',
    `status=${muteRows[0]?.status} mutedUntil=${muteRows[0]?.muted_until}`,
  );

  // 清理：撤销用户A的禁言，避免污染后续
  await db.query(`UPDATE users SET status='active', muted_until=NULL WHERE id=?`, [String(idA)]);

  // ==================== P2-15 ====================
  console.log('\n---------- P2-15 活动共读营与系统设置 ----------');

  const evTitle = `验收共读营_${Date.now()}`;
  const createEvent = await api('POST', '/admin/events', {
    token: adminToken,
    body: {
      title: evTitle,
      type: 'reading_camp',
      description: '验收用共读营',
      startTime: '2026-11-01T10:00:00+08:00',
      endTime: '2026-11-30T22:00:00+08:00',
      capacity: 2,
      memberOnly: false,
      status: 'draft',
    },
  });
  const eventId = D(createEvent)?.id;
  log(
    (createEvent.status === 201 || createEvent.status === 200) && !!eventId,
    'P2-15 管理端创建活动（草稿）',
    `status=${createEvent.status} eventId=${eventId}`,
  );

  const publicListDraft = await api('GET', '/events?size=50');
  const draftVisible = D(publicListDraft)?.items?.some((e) => e.id === eventId);
  log(!draftVisible, 'P2-15 草稿活动不对外展示');

  const detailDraft = await api('GET', `/events/${eventId}`);
  log(detailDraft.status === 404, 'P2-15 草稿活动详情不可访问', `status=${detailDraft.status}`);

  const publish = await api('PATCH', `/admin/events/${eventId}/status`, {
    token: adminToken,
    body: { status: 'ongoing' },
  });
  log(publish.status === 200 && D(publish)?.status === 'ongoing', 'P2-15 状态流转 draft→ongoing（发布）', `status=${D(publish)?.status}`);

  const publicListOn = await api('GET', '/events?size=50');
  const onVisible = D(publicListOn)?.items?.some((e) => e.id === eventId);
  log(onVisible, 'P2-15 发布后活动对外可见');

  const signup = await api('POST', `/events/${eventId}/signup`, { token: tokenB });
  log(signup.status === 201 && D(signup)?.signupCount === 1, 'P2-15 用户报名成功且计数=1', `count=${D(signup)?.signupCount}`);

  const dupSignup = await api('POST', `/events/${eventId}/signup`, { token: tokenB });
  log(dupSignup.status === 409, 'P2-15 重复报名被拒', `status=${dupSignup.status}`);

  const signupA = await api('POST', `/events/${eventId}/signup`, { token: tokenA });
  const fullSignup = await api('POST', `/events/${eventId}/signup`, { token: tokenC });
  log(
    signupA.status === 201 && D(signupA)?.signupCount === 2 && fullSignup.status === 409,
    'P2-15 名额上限生效（capacity=2，第三人被拒）',
    `count=${D(signupA)?.signupCount} thirdStatus=${fullSignup.status}`,
  );

  const adminEvents = await api('GET', `/admin/events?keyword=${encodeURIComponent(evTitle)}`, { token: adminToken });
  const adminEv = D(adminEvents)?.items?.find((e) => e.id === eventId);
  log(adminEv?.signupCount === 2, 'P2-15 管理端报名计数准确', `signupCount=${adminEv?.signupCount}`);

  const finish = await api('PATCH', `/admin/events/${eventId}/status`, {
    token: adminToken,
    body: { status: 'finished' },
  });
  log(finish.status === 200 && D(finish)?.status === 'finished', 'P2-15 状态流转 ongoing→finished（结束）', `status=${D(finish)?.status}`);

  const badTransition = await api('PATCH', `/admin/events/${eventId}/status`, {
    token: adminToken,
    body: { status: 'ongoing' },
  });
  log(badTransition.status === 400, 'P2-15 非法流转 finished→ongoing 被拒', `status=${badTransition.status}`);

  // ---- 系统设置：账号 / 角色 / 权限即时生效 / 操作日志 ----
  const accounts = await api('GET', '/admin/accounts?page=1&size=10', { token: adminToken });
  log(accounts.status === 200 && Array.isArray(D(accounts)?.items), 'P2-15 管理员账号列表可查', `total=${D(accounts)?.total}`);

  const roles = await api('GET', '/admin/roles', { token: adminToken });
  log(roles.status === 200 && Array.isArray(D(roles)), 'P2-15 角色列表可查', `roles=${(D(roles) || []).length}`);

  const ts = Date.now();
  const roleCode = `verify_${ts}`;
  const newRole = await api('POST', '/admin/roles', {
    token: adminToken,
    body: { code: roleCode, name: '验收角色', description: '自动化验收', permissions: ['dashboard'], status: 'active' },
  });
  const roleId = D(newRole)?.id;
  log(newRole.status === 201 && !!roleId, 'P2-15 新建角色', `roleId=${roleId}`);

  const newUser = `vadmin_${ts}`;
  const newAccount = await api('POST', '/admin/accounts', {
    token: adminToken,
    body: { username: newUser, password: 'verify123456', name: '验收管理员', roleCodes: [roleCode] },
  });
  const newAdminId = D(newAccount)?.id;
  log(newAccount.status === 201 && !!newAdminId, 'P2-15 新建管理员账号并分配角色', `adminId=${newAdminId}`);

  const subLogin = await api('POST', '/admin/login', { body: { username: newUser, password: 'verify123456' } });
  const subToken = D(subLogin)?.accessToken;
  log(subLogin.status === 201 && !!subToken, 'P2-15 新管理员登录成功');

  const subProfile = await api('GET', '/admin/profile', { token: subToken });
  log(subProfile.status === 200, 'P2-15 新管理员令牌可用', `status=${subProfile.status}`);

  const disableRole = await api('PATCH', `/admin/roles/${roleId}`, {
    token: adminToken,
    body: { name: '验收角色', description: '已停用', permissions: [], status: 'disabled' },
  });
  log(disableRole.status === 200, 'P2-15 变更角色权限/状态', `status=${disableRole.status}`);

  const subProfileAfter = await api('GET', '/admin/profile', { token: subToken });
  log(subProfileAfter.status === 401, 'P2-15 权限变更即时生效（旧令牌失效）', `status=${subProfileAfter.status}`);

  const opLogs = await api('GET', '/admin/operation-logs?page=1&size=20', { token: adminToken });
  const opItems = D(opLogs)?.items ?? [];
  const hasOurOp = opItems.some((l) => String(l.path).includes('/admin/events') || String(l.path).includes('/admin/roles'));
  log(opLogs.status === 200 && opItems.length > 0 && hasOurOp, 'P2-15 管理操作写入 operation_logs', `total=${D(opLogs)?.total} sample=${opItems[0]?.path}`);

  const opLogsFiltered = await api('GET', '/admin/operation-logs?page=1&size=5&module=roles', { token: adminToken });
  log(
    opLogsFiltered.status === 200 && (D(opLogsFiltered)?.total ?? 0) > 0,
    'P2-15 操作日志按模块筛选可用',
    `status=${opLogsFiltered.status} total=${D(opLogsFiltered)?.total}`,
  );

  // 清理测试数据
  await api('DELETE', `/admin/events/${eventId}`, { token: adminToken });
  await api('DELETE', `/admin/accounts/${newAdminId}`, { token: adminToken });

  console.log(`\n===== 汇总：PASS ${pass} / FAIL ${fail} =====`);
  process.exitCode = fail === 0 ? 0 : 1;
} catch (err) {
  console.error('脚本异常：', err?.message ?? err);
  process.exitCode = 1;
} finally {
  await db.end();
}
