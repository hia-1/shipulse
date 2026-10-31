# Design Token 说明 · 时脉书社-阅读世界

> 依据：项目根目录 `DESIGN.md`（Reading Pulse Minimal）。本文件说明 Token 在代码中的落地位置与映射关系。

## 落地位置

| Token 类别 | 落地位置 |
| --- | --- |
| 色板（含双主题变量） | `src/assets/main.css`（CSS 变量 `--c-*`）+ `tailwind.config.js`（颜色映射） |
| 字体层级 | `src/assets/main.css`（`.text-display-lg` ~ `.text-label-sm` 组件类） |
| 间距 / 圆角 / 投影 / 容器宽度 | `tailwind.config.js` |
| 双主题切换 | `src/composables/useTheme.ts`（light / dark / system，根节点 `.dark` 类） |
| 基础组件 | `src/components/base/`（演示页：`/design` 路由） |

## 色板

浅色值与 DESIGN.md `colors` 一一对应：

| Tailwind 类 | 浅色值 | 来源 |
| --- | --- | --- |
| `paper-base` | #FBFBFA | paper-base |
| `paper-warm` | #F7F7F5 | paper-warm |
| `paper-elevated` | #FFFFFF | paper-elevated |
| `ink-primary` | #1A2421 | ink-primary |
| `ink-secondary` | #4A5451 | ink-secondary |
| `ink-muted` | #8A9490 | ink-muted |
| `ink-faint` | #BCC3C0 | ink-faint |
| `pine-deep` | #2D4A43 | pine-deep（主色） |
| `pine-hover` | #243C36 | Buttons 悬停色 |
| `pine-subtle` | #E8EFEA | pine-subtle |
| `gold-patina` | #C29B38 | gold-patina（成就/会员） |
| `gold-tint` | #F9F5EC | gold-tint |
| `hairline` | #EAE8E3 | border-hairline |
| `border-muted` | #E0DED7 | border-muted |
| `danger` | #BA1A1A | error |

### 深色模式映射

DESIGN.md 未定义深色 Token，深色值按「纸墨反转」原则推导（保持同一色相、反转明度），已在 `main.css` `.dark` 块实现：纸面转深炭灰（#16181F 系）、墨色转浅灰白、松绿主色提亮一档保证对比度、金色提亮、边界转深灰。**如后续 DESIGN.md 补充官方深色值，以 DESIGN.md 为准替换。**

## 字体层级

| 类名 | 字体 | 字号/行高 | 用途 |
| --- | --- | --- | --- |
| `text-display-lg(-mobile)` | Noto Serif 600 | 40/52（移动 30/40） | 页面大标题 |
| `text-headline-lg(-mobile)` / `md` / `sm` | Noto Serif | 32/44、24/34、20/28 | 区块标题 |
| `text-title-lg` | Noto Serif 500 | 18/26 | 书名、栏目标题 |
| `text-title-md` | Inter 600 | 16/24 | 模块标题 |
| `text-body-lg` / `md` / `sm` | Inter 400 | 17/30、15/26、13/20 | 正文 |
| `text-label-md` / `sm` | Inter 500 | 13/18、11/16 | 标签/按钮文字 |

数字（阅读分钟、计时）使用 `.tabular-nums` 等宽数字。

## 间距

`space-2xs`(4px) `xs`(8) `sm`(12) `md`(16) `lg`(24) `xl`(32) `2xl`(48) `3xl`(72) `4xl`(96)；容器 `max-w-container`(1200px)、长文栏 `max-w-reading`(680px)。

## 圆角

`rounded-sm`(4px 书封) `rounded`(8px 按钮/Chip/输入) `rounded-md`(12) `rounded-lg`(16px 卡片/模态) `rounded-xl`(24) `rounded-full`(时脉节点)。

## 投影（Elevation）

| 类 | 层级 | 用途 |
| --- | --- | --- |
| `shadow-level-0` | Level 0 | 画布，无投影 |
| `shadow-level-1` | Level 1 | 静态卡片 |
| `shadow-level-2` | Level 2 | 悬浮计时器 / 悬停书卡 |
| `shadow-spine` | — | 书封书脊投影（2px 4px 12px） |
| Level 3 | — | 模态磨砂：`backdrop-filter: blur(8px)` + `rgba(251,251,250,.85)`（见 BaseModal） |

## 基础组件清单（`src/components/base/`）

| 组件 | 说明 |
| --- | --- |
| `BaseButton` | primary / ghost / text 三变体，含悬停抬升与禁用态 |
| `BaseChip` | 筛选 Chip：默认 / 选中 / 禁用 |
| `BaseInput` / `BaseTextarea` | 聚焦 pine-deep 边框 + 3px 光晕 |
| `BaseCard` | Level 1 表面，`hoverable` 悬停升 Level 2 |
| `BaseModal` | Level 3 磨砂背景，Teleport + 过渡 |
| `BaseEmpty` | 空状态（图标/标题/描述/操作插槽） |
| `BookCover` | 3:4 书封 + 书脊投影 + 左侧书脊高光 |
