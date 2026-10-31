/**
 * 用户生成内容（UGC）安全清洗（P2-16 安全加固）
 *
 * 本项目 UGC 均为纯文本字段（书评/评论/动态/书单/昵称/简介），不承载富文本。
 * 前端（Vue/WXML）默认转义输出，但为防止未来出现 v-html / rich-text 等 HTML 渲染
 * 出口导致存储型 XSS，统一在服务端写入前剥离 HTML 标签与控制字符，做纵深防御。
 */

/** 去除 HTML 标签与不可见控制字符，保留纯文本语义 */
export function stripHtmlTags(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

/** 清洗可选文本：undefined/null 原样返回，其余去标签 + 去首尾空白 */
export function sanitizeText(input: string | null | undefined): string {
  if (input == null) return input as unknown as string;
  return stripHtmlTags(input).trim();
}
