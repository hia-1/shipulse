// E 类权威冒烟：以「数据库真实行数」为基线，验证并发/幂等后计数与状态始终一致
import mysql from 'mysql2/promise';

const BASE = 'http://127.0.0.1:3000';
const db = await mysql.createConnection({
  host: '127.0.0.1', port: 3306, user: 'shipulse', password: 'change_me', database: 'shipulse',
});
const q = async (sql, p = []) => (await db.query(sql, p))[0];

async function api(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const t = await res.text();
  let j; try { j = JSON.parse(t); } catch { j = t; }
  const data = j && typeof j === 'object' && 'data' in j ? j.data : j;
  return { status: res.status, data, raw: j };
}
const login = async (phone) => {
  const r = await api('POST', '/api/auth/login', { body: { phone, code: '123456' } });
  if (!r.data?.accessToken) throw new Error(`login ${phone} fail ${JSON.stringify(r.raw)}`);
  return r.data.accessToken;
};
const results = [];
const check = (name, ok, detail) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${detail}`); };

async function main() {
  const UID = 2;
  const token = await login('13800000002');

  // ================= E1: 动态点赞 =================
  const [post] = await q(
    `SELECT id FROM posts WHERE audit_status='approved' AND deleted_at IS NULL ORDER BY id LIMIT 1`);
  const pid = post.id;
  // 重置为真实基线：删除本人点赞行 + 计数对齐真实行数
  await q(`DELETE FROM likes WHERE user_id=? AND target_type='post' AND target_id=? AND interaction_type='like'`, [UID, pid]);
  await q(`UPDATE posts SET like_count=(SELECT COUNT(*) FROM likes WHERE target_type='post' AND target_id=? AND interaction_type='like') WHERE id=?`, [pid, pid]);
  const rowsOf = async () => (await q(`SELECT COUNT(*) c FROM likes WHERE target_type='post' AND target_id=? AND interaction_type='like'`, [pid]))[0].c;
  const countOf = async () => (await q(`SELECT like_count c FROM posts WHERE id=?`, [pid]))[0].c;

  const base = await countOf();
  const baseRows = await rowsOf();
  check('E1 基线一致（计数=真实行数）', base === baseRows, `count=${base} rows=${baseRows} post=${pid}`);

  await Promise.all(Array.from({ length: 10 }, () => api('POST', `/api/posts/${pid}/like`, { token })));
  const c1 = await countOf(); const r1 = await rowsOf();
  const d1 = (await api('GET', `/api/posts/${pid}`, { token })).data;
  const mine1 = (await q(`SELECT COUNT(*) c FROM likes WHERE user_id=? AND target_type='post' AND target_id=? AND interaction_type='like'`, [UID, pid]))[0].c;
  check('E1 并发点赞：计数=行数，本人行≤1',
    c1 === r1 && mine1 <= 1 && c1 === base + mine1,
    `count=${c1} rows=${r1} mine=${mine1} base=${base}`);
  check('E1 接口 isLiked 与本人行一致', d1.isLiked === (mine1 === 1), `isLiked=${d1.isLiked} mine=${mine1}`);

  // 再切换一次：状态翻转，计数与行数仍一致
  const d2 = (await api('POST', `/api/posts/${pid}/like`, { token })).data;
  const c2 = await countOf(); const r2 = await rowsOf();
  const mine2 = (await q(`SELECT COUNT(*) c FROM likes WHERE user_id=? AND target_type='post' AND target_id=? AND interaction_type='like'`, [UID, pid]))[0].c;
  check('E1 再切换：状态翻转且计数=行数',
    d2.isLiked === !d1.isLiked && c2 === r2 && c2 === base + mine2,
    `isLiked ${d1.isLiked}->${d2.isLiked} count=${c2} rows=${r2} mine=${mine2}`);

  // ================= E2: 重复支付幂等 =================
  const freshPhone = `139${String(Date.now()).slice(-8)}`;
  let ft;
  const reg = await api('POST', '/api/auth/register', { body: { phone: freshPhone, code: '123456' } });
  ft = reg.data?.accessToken ?? (await login(freshPhone));
  const freshId = (await q('SELECT id FROM users WHERE phone=?', [freshPhone]))[0].id;
  const plans = (await api('GET', '/api/membership/plans', { token: ft })).data;
  const plan = (plans?.list ?? plans ?? [])[0];
  const order = (await api('POST', '/api/membership/orders', { token: ft, body: { planId: plan.id } })).data;
  const orderNo = order?.orderNo ?? order?.order?.orderNo;
  const con = await Promise.all(Array.from({ length: 6 }, () => api('POST', '/api/membership/pay/sandbox', { token: ft, body: { orderNo } })));
  const exps = con.map((r) => r.data?.memberExpireAt).filter(Boolean);
  const subCnt = (await q(`SELECT COUNT(*) c FROM member_subscriptions WHERE user_id=? AND status='active'`, [freshId]))[0].c;
  check('E2 重复支付：仅一条有效订阅且到期时间一致',
    con.every((r) => r.status < 500) && exps.length > 0 && new Set(exps).size === 1 && subCnt === 1,
    `codes=${con.map((r) => r.status).join(',')} exps=${[...new Set(exps)].join('|')} activeSubs=${subCnt}`);

  // ================= E4: 书单收藏（选非本人书单）=================
  const [bl] = await q(
    `SELECT id FROM booklists WHERE user_id<>? AND audit_status='approved' AND published_at IS NOT NULL ORDER BY collect_count DESC LIMIT 1`, [String(UID)]);
  const bid = bl.id;
  await q(`DELETE FROM likes WHERE user_id=? AND target_type='booklist' AND target_id=? AND interaction_type='collect'`, [UID, bid]);
  await q(`UPDATE booklists SET collect_count=(SELECT COUNT(*) FROM likes WHERE target_type='booklist' AND target_id=? AND interaction_type='collect') WHERE id=?`, [bid, bid]);
  const ccOf = async () => (await q('SELECT collect_count c FROM booklists WHERE id=?', [bid]))[0].c;
  const cRows = async () => (await q(`SELECT COUNT(*) c FROM likes WHERE target_type='booklist' AND target_id=? AND interaction_type='collect'`, [bid]))[0].c;

  const b0 = await ccOf(); const br0 = await cRows();
  check('E4 基线一致', b0 === br0, `count=${b0} rows=${br0} list=${bid}`);

  await Promise.all(Array.from({ length: 8 }, () => api('POST', `/api/booklists/${bid}/collect`, { token })));
  const b1 = await ccOf(); const br1 = await cRows();
  const mineC = (await q(`SELECT COUNT(*) c FROM likes WHERE user_id=? AND target_type='booklist' AND target_id=? AND interaction_type='collect'`, [UID, bid]))[0].c;
  check('E4 并发收藏：计数=行数，本人≤1 行',
    b1 === br1 && mineC <= 1 && b1 === b0 + mineC, `count=${b1} rows=${br1} mine=${mineC} base=${b0}`);

  await Promise.all(Array.from({ length: 8 }, () => api('POST', `/api/booklists/${bid}/collect`, { token })));
  const b2 = await ccOf();
  check('E4 重复收藏幂等：计数不变', b2 === b1, `after2=${b2} (期望 ${b1})`);

  await Promise.all(Array.from({ length: 8 }, () => api('DELETE', `/api/booklists/${bid}/collect`, { token })));
  const b3 = await ccOf(); const br3 = await cRows();
  check('E4 并发取消：计数=行数且不为负', b3 === br3 && b3 >= 0 && b3 === b0,
    `afterUn=${b3} rows=${br3} (期望 ${b0})`);

  // ================= E5: 书单加书/移除 =================
  const created = (await api('POST', '/api/booklists', { token, body: { title: `E5并发-${Date.now()}` } })).data;
  const myListId = created?.id ?? created?.created?.id;
  const [book] = await q(`SELECT id FROM books WHERE deleted_at IS NULL LIMIT 1`);
  await q(`DELETE FROM booklist_items WHERE booklist_id=?`, [myListId]);
  await q(`UPDATE booklists SET item_count=(SELECT COUNT(*) FROM booklist_items WHERE booklist_id=?) WHERE id=?`, [myListId, myListId]);
  const icOf = async () => (await q('SELECT item_count c FROM booklists WHERE id=?', [myListId]))[0].c;
  const iRows = async () => (await q('SELECT COUNT(*) c FROM booklist_items WHERE booklist_id=?', [myListId]))[0].c;

  await Promise.all(Array.from({ length: 8 }, () => api('POST', `/api/booklists/${myListId}/items`, { token, body: { bookId: book.id } })));
  const ic1 = await icOf(); const ir1 = await iRows();
  check('E5 并发加书：不重复，计数=行数', ir1 === 1 && ic1 === ir1, `itemCount=${ic1} rows=${ir1}`);

  await Promise.all(Array.from({ length: 8 }, () => api('DELETE', `/api/booklists/${myListId}/items/${book.id}`, { token })));
  const ic2 = await icOf(); const ir2 = await iRows();
  check('E5 并发移除：计数=行数且不为负', ic2 === ir2 && ic2 >= 0, `itemCount=${ic2} rows=${ir2}`);

  // ================= E3: 兑换码并发核销（一次性）=================
  const code = `E2E${String(Date.now()).slice(-8)}`;
  await q(`INSERT INTO redeem_codes (code, batch_no, plan_id, duration_days, status) VALUES (?,?,?,?,'unused')`,
    [code, 'E2E', 1, 30]);
  const rPhone = `139${String(Date.now() + 7).slice(-8)}`;
  const rReg = await api('POST', '/api/auth/register', { body: { phone: rPhone, code: '123456' } });
  const rTok = rReg.data?.accessToken ?? (await login(rPhone));
  const rUid = (await q('SELECT id FROM users WHERE phone=?', [rPhone]))[0].id;
  const rCon = await Promise.all(Array.from({ length: 8 }, () => api('POST', '/api/membership/redeem', { token: rTok, body: { code } })));
  const okCnt = rCon.filter((r) => r.status < 400).length;
  const codeStatus = (await q('SELECT status FROM redeem_codes WHERE code=?', [code]))[0].status;
  const rSubs = (await q(`SELECT COUNT(*) c FROM member_subscriptions WHERE user_id=? AND status='active'`, [rUid]))[0].c;
  check('E3 并发核销兑换码：仅一次成功，码置 used，仅一条订阅',
    okCnt === 1 && codeStatus === 'used' && rSubs === 1,
    `ok=${okCnt} status=${codeStatus} activeSubs=${rSubs} codes=${rCon.map((r) => r.status).join(',')}`);

  // ================= E6: 阅读场次并发结束（ongoing→finished 只生效一次）=================
  const [rbook] = await q(`SELECT id FROM books WHERE deleted_at IS NULL AND status='on_shelf' LIMIT 1`);
  const sPhone = `139${String(Date.now() + 13).slice(-8)}`;
  const sReg = await api('POST', '/api/auth/register', { body: { phone: sPhone, code: '123456' } });
  const sTok = sReg.data?.accessToken ?? (await login(sPhone));
  const sUid = (await q('SELECT id FROM users WHERE phone=?', [sPhone]))[0].id;
  const sCreate = await api('POST', '/api/reading/sessions', { token: sTok, body: { bookId: rbook.id, startPage: 1 } });
  const sid = sCreate.data?.sessionId ?? sCreate.data?.id;
  const fCon = await Promise.all(Array.from({ length: 8 }, () =>
    api('PATCH', `/api/reading/sessions/${sid}/finish`, { token: sTok, body: { endPage: 50, note: 'e2e' } })));
  const sRow = (await q('SELECT status, duration_seconds, end_page FROM reading_sessions WHERE id=?', [sid]))[0];
  const sCnt = (await q('SELECT COUNT(*) c FROM reading_sessions WHERE user_id=?', [sUid]))[0].c;
  check('E6 并发结束场次：状态 finished，行数=1，无重复结算',
    sRow?.status === 'finished' && sCnt === 1 && sRow?.end_page === 50,
    `status=${sRow?.status} rows=${sCnt} endPage=${sRow?.end_page} codes=${fCon.map((r) => r.status).join(',')}`);
  // 再次结束应被拒（已结束）
  const again = await api('PATCH', `/api/reading/sessions/${sid}/finish`, { token: sTok, body: { endPage: 99 } });
  const sRow2 = (await q('SELECT end_page FROM reading_sessions WHERE id=?', [sid]))[0];
  check('E6 重复结束被拒且不覆盖数据', again.status >= 400 && sRow2?.end_page === 50,
    `againStatus=${again.status} endPage=${sRow2?.end_page}`);

  // ================= 清理本次冒烟创建的书单 =================
  await q(`DELETE FROM booklist_items WHERE booklist_id IN (SELECT id FROM booklists WHERE title LIKE 'E5并发-%' OR title LIKE 'E类冒烟-%')`);
  await q(`DELETE FROM booklists WHERE title LIKE 'E5并发-%' OR title LIKE 'E类冒烟-%'`);

  const passed = results.filter(Boolean).length;
  console.log(`\n==== 汇总: ${passed}/${results.length} 通过 ====`);
  if (passed !== results.length) process.exitCode = 1;
}

main().catch((e) => { console.error('SMOKE_ERROR', e); process.exitCode = 1; })
  .finally(() => db.end());