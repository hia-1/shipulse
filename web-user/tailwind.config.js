/**
 * Tailwind 主题配置 · Design Token 落地
 * 依据：DESIGN.md（Reading Pulse Minimal）
 * 色值通过 CSS 变量（--c-*）注入，支持浅色/深色双主题，见 src/assets/main.css
 */

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 纸面体系（Surface）
        paper: {
          base: 'rgb(var(--c-paper-base) / <alpha-value>)',
          warm: 'rgb(var(--c-paper-warm) / <alpha-value>)',
          elevated: 'rgb(var(--c-paper-elevated) / <alpha-value>)',
        },
        // 墨色体系（Ink 三级 + 弱化）
        ink: {
          primary: 'rgb(var(--c-ink-primary) / <alpha-value>)',
          secondary: 'rgb(var(--c-ink-secondary) / <alpha-value>)',
          muted: 'rgb(var(--c-ink-muted) / <alpha-value>)',
          faint: 'rgb(var(--c-ink-faint) / <alpha-value>)',
        },
        // 品牌松绿（Primary）
        pine: {
          deep: 'rgb(var(--c-pine-deep) / <alpha-value>)',
          hover: 'rgb(var(--c-pine-hover) / <alpha-value>)',
          subtle: 'rgb(var(--c-pine-subtle) / <alpha-value>)',
        },
        // 铜青金（Secondary：成就/会员/里程碑）
        gold: {
          patina: 'rgb(var(--c-gold-patina) / <alpha-value>)',
          tint: 'rgb(var(--c-gold-tint) / <alpha-value>)',
        },
        // 边界
        hairline: 'rgb(var(--c-border-hairline) / <alpha-value>)',
        'border-muted': 'rgb(var(--c-border-muted) / <alpha-value>)',
        // 语义色
        danger: {
          DEFAULT: 'rgb(var(--c-error) / <alpha-value>)',
          container: 'rgb(var(--c-error-container) / <alpha-value>)',
          content: 'rgb(var(--c-on-error-container) / <alpha-value>)',
        },
      },
      fontFamily: {
        // 编辑性标题与书名：宋体衬线（Noto Serif SC 为本地自托管）
        serif: ['"Noto Serif SC"', '"Noto Serif"', '"Source Han Serif SC"', '"STSong"', 'serif'],
        // 正文/数据/系统 UI
        sans: ['Inter', '"PingFang SC"', '"Source Han Sans SC"', '"Microsoft YaHei"', 'sans-serif'],
      },
      spacing: {
        // DESIGN.md spacing：space-2xs ~ space-4xl
        '2xs': '0.25rem', // 4px
        xs: '0.5rem', // 8px
        sm: '0.75rem', // 12px
        md: '1rem', // 16px
        lg: '1.5rem', // 24px
        xl: '2rem', // 32px
        '2xl': '3rem', // 48px
        '3xl': '4.5rem', // 72px
        '4xl': '6rem', // 96px
        'gutter-mobile': '1rem', // 16px 页面左右留白（<768px）
        'gutter-desktop': '2rem', // 32px 页面左右留白（≥1024px）
      },
      maxWidth: {
        container: '1200px', // container-max
        reading: '680px', // reading-column-max（长文/书评栏宽）
      },
      borderRadius: {
        // DESIGN.md rounded：sm ~ full（DEFAULT = 0.5rem）
        sm: '0.25rem',
        DEFAULT: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.5rem',
        full: '9999px',
      },
      boxShadow: {
        // DESIGN.md Elevation Level 0~3（Level 3 为磨砂背景，见 BaseModal）
        'level-0': 'none',
        'level-1':
          '0 2px 12px -2px rgba(26, 36, 33, 0.03), 0 1px 3px 0 rgba(26, 36, 33, 0.02)',
        'level-2':
          '0 8px 24px -4px rgba(26, 36, 33, 0.06), 0 2px 6px -1px rgba(26, 36, 33, 0.03)',
        // 书封书脊投影（3:4 书封左侧）
        spine: '2px 4px 12px rgba(26, 36, 33, 0.08)',
      },
    },
  },
  plugins: [],
}
