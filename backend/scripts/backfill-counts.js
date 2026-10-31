/* 一次性回填冗余字段：categories.book_count、categories.parent_id 无；tags.use_count */
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'shipulse',
    password: 'change_me',
    database: 'shipulse',
  });

  // categories.book_count = 该分类(含直接子分类)下未删除书籍数
  await conn.query(`
    UPDATE categories c SET c.book_count = 0;
  `);
  const [cats] = await conn.query(`SELECT id, parent_id FROM categories`);
  for (const cat of cats) {
    const childIds = cats.filter((c) => Number(c.parent_id) === Number(cat.id)).map((c) => Number(c.id));
    const scope = [Number(cat.id), ...childIds];
    const [rows] = await conn.query(
      `SELECT COUNT(*) AS n FROM books WHERE category_id IN (?) AND deleted_at IS NULL`,
      [scope],
    );
    await conn.query(
      `UPDATE categories SET book_count = ? WHERE id = ?`,
      [rows[0].n, cat.id],
    );
  }

  // tags.use_count = 引用数
  await conn.query(`
    UPDATE tags t SET t.use_count = (SELECT COUNT(*) FROM book_tags bt
      JOIN books b ON b.id = bt.book_id AND b.deleted_at IS NULL
      WHERE bt.tag_id = t.id AND b.status = 'on_shelf')
  `);

  const [rows] = await conn.query(`SELECT id, name, book_count FROM categories ORDER BY id`);
  console.log('categories counts:', rows);

  await conn.end();
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});