import mysql from 'mysql2/promise';

const c = await mysql.createConnection({
  host: '127.0.0.1', port: 3306, user: 'shipulse', password: 'change_me', database: 'shipulse',
});
const q = async (s) => (await c.query(s))[0];

// 各计数器的「真实值」子查询
const targets = [
  {
    name: 'posts.like_count',
    drift: `SELECT p.id, p.like_count AS stored_cnt,
      (SELECT COUNT(*) FROM likes l WHERE l.target_type='post' AND l.target_id=p.id AND l.interaction_type='like') AS real_cnt
      FROM posts p WHERE p.like_count <> (SELECT COUNT(*) FROM likes l WHERE l.target_type='post' AND l.target_id=p.id AND l.interaction_type='like')`,
    fix: `UPDATE posts p SET p.like_count = (
      SELECT COUNT(*) FROM likes l WHERE l.target_type='post' AND l.target_id=p.id AND l.interaction_type='like')`,
  },
  {
    name: 'reviews.like_count',
    drift: `SELECT r.id, r.like_count AS stored_cnt,
      (SELECT COUNT(*) FROM likes l WHERE l.target_type='review' AND l.target_id=r.id AND l.interaction_type='like') AS real_cnt
      FROM reviews r WHERE r.like_count <> (SELECT COUNT(*) FROM likes l WHERE l.target_type='review' AND l.target_id=r.id AND l.interaction_type='like')`,
    fix: `UPDATE reviews r SET r.like_count = (
      SELECT COUNT(*) FROM likes l WHERE l.target_type='review' AND l.target_id=r.id AND l.interaction_type='like')`,
  },
  {
    name: 'booklists.collect_count',
    drift: `SELECT b.id, b.collect_count AS stored_cnt,
      (SELECT COUNT(*) FROM likes l WHERE l.target_type='booklist' AND l.target_id=b.id AND l.interaction_type='collect') AS real_cnt
      FROM booklists b WHERE b.collect_count <> (SELECT COUNT(*) FROM likes l WHERE l.target_type='booklist' AND l.target_id=b.id AND l.interaction_type='collect')`,
    fix: `UPDATE booklists b SET b.collect_count = (
      SELECT COUNT(*) FROM likes l WHERE l.target_type='booklist' AND l.target_id=b.id AND l.interaction_type='collect')`,
  },
  {
    name: 'booklists.item_count',
    drift: `SELECT b.id, b.item_count AS stored_cnt,
      (SELECT COUNT(*) FROM booklist_items i WHERE i.booklist_id=b.id) AS real_cnt
      FROM booklists b WHERE b.item_count <> (SELECT COUNT(*) FROM booklist_items i WHERE i.booklist_id=b.id)`,
    fix: `UPDATE booklists b SET b.item_count = (SELECT COUNT(*) FROM booklist_items i WHERE i.booklist_id=b.id)`,
  },
];

console.log('===== 修复前漂移明细 =====');
for (const t of targets) {
  const rows = await q(t.drift);
  console.log(`\n[${t.name}] 漂移 ${rows.length} 行`);
  for (const r of rows) console.log(`  id=${r.id} 存储=${r.stored_cnt} 真实=${r.real_cnt}`);
}

console.log('\n===== 执行对账修复 =====');
for (const t of targets) {
  const res = await c.query(t.fix);
  const affected = res[0].affectedRows ?? 0;
  console.log(`  ${t.name}: 更新 ${affected} 行`);
}

console.log('\n===== 修复后复核（应全部为 0）=====');
let total = 0;
for (const t of targets) {
  const rows = await q(t.drift);
  total += rows.length;
  console.log(`  ${t.name}: 剩余漂移 ${rows.length} 行`);
}
console.log(`\n总计剩余漂移: ${total} 行 ${total === 0 ? '（已全部对齐）' : '（仍有残留，需排查）'}`);

await c.end();