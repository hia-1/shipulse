import { Injectable, Logger } from '@nestjs/common';

export interface IsbnBookMeta {
  isbn: string;
  title: string;
  subtitle: string;
  author: string;
  translator: string;
  publisher: string;
  publishedDate: string;
  pages: number;
  coverUrl: string;
  description: string | null;
}

/**
 * ISBN 集成适配层：对接三方书目 API（OpenLibrary）。
 * 任一环节异常或未命中均优雅降级，绝不抛出异常阻塞调用方；返回 null 由上层引导手动录入。
 */
@Injectable()
export class IsbnService {
  private readonly logger = new Logger(IsbnService.name);

  async fetchByIsbn(isbn: string): Promise<IsbnBookMeta | null> {
    const clean = isbn.replace(/[\s-]/g, '');
    if (!/^\d{10}(\d{3})?$/.test(clean)) return null;

    try {
      const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${clean}&format=json&jscmd=data`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!resp.ok) {
        this.logger.warn(`ISBN ${clean} upstream http ${resp.status}`);
        return null;
      }
      const data = await resp.json();
      const entry = data?.[`ISBN:${clean}`];
      if (!entry) {
        this.logger.warn(`ISBN ${clean} not found in upstream`);
        return null;
      }
      return this.normalize(clean, entry);
    } catch (e) {
      // 网络失败 / 超时 / 解析失败 → 优雅降级
      this.logger.warn(`ISBN ${clean} fetch degraded: ${(e as Error).message}`);
      return null;
    }
  }

  private normalize(isbn: string, entry: Record<string, unknown>): IsbnBookMeta {
    const authors = Array.isArray(entry.authors)
      ? entry.authors.map((a) => (a as { name?: string }).name ?? '').filter(Boolean)
      : [];
    const cover =
      (entry.cover as { large?: string; medium?: string; small?: string })?.large ??
      (entry.cover as { medium?: string })?.medium ??
      (entry.cover as { small?: string })?.small ??
      '';
    const desc = entry.description
      ? typeof entry.description === 'string'
        ? entry.description
        : (entry.description as { value?: string }).value ?? null
      : null;

    return {
      isbn,
      title: (entry.title as string) ?? '',
      subtitle: '',
      author: authors.join(', '),
      translator: '',
      publisher: String(entry.publishers?.[0]?.name ?? ''),
      publishedDate: String(entry.publish_date ?? ''),
      pages: Number((entry as { number_of_pages?: number }).number_of_pages) || 0,
      coverUrl: cover || '',
      description: desc,
    };
  }
}