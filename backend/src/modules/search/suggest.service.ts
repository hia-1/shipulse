import { Injectable } from '@nestjs/common';
import { BooksService } from '../library/books.service';

/** 不合格的 ISBN：10 位（旧 9 位不带校验位）或 13 位 EAN，允许连字符/空格 */
const ISBN_RE = /^\d{10}(\d{3})?$/;

@Injectable()
export class SuggestService {
  constructor(private readonly booksService: BooksService) {}

  /**
   * 搜索联想：书名匹配候选 + ISBN 精确命中（hit 直达详情）
   * @returns { books, isbnHit|null }  isbnHit 表示输入是 ISBN 且命中了某本书
   */
  async suggest(keyword: string, limit = 8) {
    const k = (keyword || '').trim();
    const result: { books: Record<string, unknown>[]; isbnHit: Record<string, unknown> | null } = {
      books: [],
      isbnHit: null,
    };
    if (!k) return result;

    // ISBN 精确匹配（整串为纯数字且位数符合）
    const clean = k.replace(/[\s-]/g, '');
    if (ISBN_RE.test(clean)) {
      const hit = await this.booksService.findByIsbn(clean);
      result.isbnHit = hit as unknown as Record<string, unknown> | null;
    }

    // 书名/作者/副标题联想
    const cap = Math.max(1, Math.min(limit, 10));
    const res = await this.booksService.list(
      { page: 1, pageSize: cap, keyword: k, sort: 'default' },
      false,
    );
    result.books = res.list;
    return result;
  }
}