/**
 * 应用 P2-08 订阅消息建表迁移（幂等）。
 * 用法：node scripts/apply-06-migration.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(__dirname, '../../db/init/06_p2_08_subscribe.sql');

const conn = await mysql.createConnection({
  host: '127.0.0.1',
  port: 3306,
  user: 'shipulse',
  password: 'change_me',
  database: 'shipulse',
  multipleStatements: true,
});

try {
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await conn.query(sql);
  const [tables] = await conn.query(
    "SHOW TABLES LIKE 'subscribe_authorizations'",
  );
  console.log('migration applied, tables=', JSON.stringify(tables));
} catch (e) {
  console.error('migration failed:', e?.message || e);
  process.exitCode = 1;
} finally {
  await conn.end();
}
