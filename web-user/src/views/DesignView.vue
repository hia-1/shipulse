<script setup lang="ts">
import { ref } from 'vue'
import {
  BaseButton,
  BaseChip,
  BaseInput,
  BaseTextarea,
  BaseCard,
  BaseModal,
  BaseEmpty,
  BookCover,
} from '@/components/base'
import { useTheme, type ThemeMode } from '@/composables/useTheme'

const { mode } = useTheme()
const modes: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' },
]

const selectedChip = ref('全部')
const chips = ['全部', '文学', '社科', '科技', '历史']
const inputText = ref('')
const textareaText = ref('')
const modalOpen = ref(false)
</script>

<template>
  <main class="mx-auto max-w-container px-xl py-2xl">
    <header class="mb-2xl flex items-start justify-between">
      <div>
        <h1 class="text-display-lg-mobile md:text-display-lg">设计系统 · 基础组件</h1>
        <p class="mt-xs text-body-md text-ink-secondary">
          Reading Pulse Minimal — Token 与组件状态总览（P0-02）
        </p>
      </div>
      <div class="flex gap-xs">
        <BaseChip
          v-for="m in modes"
          :key="m.value"
          :selected="mode === m.value"
          @click="mode = m.value"
        >
          {{ m.label }}
        </BaseChip>
      </div>
    </header>

    <!-- 字体层级 -->
    <section class="mb-2xl">
      <h2 class="mb-md text-headline-sm text-ink-secondary">字体层级</h2>
      <BaseCard class="space-y-sm p-lg">
        <p class="text-display-lg-mobile">display-lg-mobile · 时脉书社</p>
        <p class="text-headline-lg-mobile">headline-lg-mobile · 阅读世界</p>
        <p class="text-headline-md">headline-md · 记录每一次阅读的脉动</p>
        <p class="text-title-lg">title-lg · 书名与栏目标题（Noto Serif）</p>
        <p class="text-title-md">title-md · 模块标题（Inter）</p>
        <p class="text-body-lg">body-lg · 正文大字号，行高 30px，适合长文阅读。</p>
        <p class="text-body-md">body-md · 常规正文，行高 26px。</p>
        <p class="text-body-sm">body-sm · 辅助说明文字。</p>
        <p class="text-label-md">label-md · 标签文字</p>
        <p class="text-label-sm">label-sm · 小标签 · 128 分钟 · <span class="tabular-nums">00:42:16</span></p>
      </BaseCard>
    </section>

    <!-- 按钮 -->
    <section class="mb-2xl">
      <h2 class="mb-md text-headline-sm text-ink-secondary">按钮</h2>
      <BaseCard class="flex flex-wrap items-center gap-md p-lg">
        <BaseButton variant="primary">主按钮</BaseButton>
        <BaseButton variant="primary" disabled>主按钮·禁用</BaseButton>
        <BaseButton variant="ghost">幽灵按钮</BaseButton>
        <BaseButton variant="ghost" disabled>幽灵·禁用</BaseButton>
        <BaseButton variant="text">文字链接</BaseButton>
      </BaseCard>
    </section>

    <!-- Chip 与筛选器 -->
    <section class="mb-2xl">
      <h2 class="mb-md text-headline-sm text-ink-secondary">Chip 与筛选器</h2>
      <BaseCard class="p-lg">
        <div class="flex flex-wrap gap-sm">
          <BaseChip
            v-for="c in chips"
            :key="c"
            :selected="selectedChip === c"
            @click="selectedChip = c"
          >
            {{ c }}
          </BaseChip>
          <BaseChip disabled>禁用</BaseChip>
        </div>
      </BaseCard>
    </section>

    <!-- 输入框与文本域 -->
    <section class="mb-2xl">
      <h2 class="mb-md text-headline-sm text-ink-secondary">输入框与文本域</h2>
      <BaseCard class="grid gap-md p-lg md:grid-cols-2">
        <div class="space-y-sm">
          <BaseInput v-model="inputText" placeholder="搜索书名 / 作者 / ISBN（点击体验聚焦光晕）" />
          <BaseInput model-value="禁用状态" disabled />
        </div>
        <div class="space-y-sm">
          <BaseTextarea v-model="textareaText" placeholder="写下你的读书笔记或书评…" />
          <BaseTextarea model-value="禁用状态" disabled :rows="2" />
        </div>
      </BaseCard>
    </section>

    <!-- 内容卡片 -->
    <section class="mb-2xl">
      <h2 class="mb-md text-headline-sm text-ink-secondary">内容卡片（Level 1 / 悬停 Level 2）</h2>
      <div class="grid gap-lg md:grid-cols-2">
        <BaseCard class="p-lg">
          <p class="text-title-md">静态卡片</p>
          <p class="mt-xs text-body-sm text-ink-muted">Surface Level 1：白底 + hairline 边 + 轻投影。</p>
        </BaseCard>
        <BaseCard hoverable class="p-lg">
          <p class="text-title-md">悬停卡片</p>
          <p class="mt-xs text-body-sm text-ink-muted">悬停抬升至 Level 2，试试把鼠标移上来。</p>
        </BaseCard>
      </div>
    </section>

    <!-- 书封卡 -->
    <section class="mb-2xl">
      <h2 class="mb-md text-headline-sm text-ink-secondary">书封卡（3:4 + 书脊投影）</h2>
      <div class="grid grid-cols-3 gap-lg md:grid-cols-6">
        <BookCover title="百年孤独" />
        <BookCover title="活着" />
        <BookCover title="小王子" />
        <BookCover title="人类简史" />
        <BookCover title="红楼梦" />
        <BookCover title="1984" />
      </div>
    </section>

    <!-- 模态面板 -->
    <section class="mb-2xl">
      <h2 class="mb-md text-headline-sm text-ink-secondary">模态面板（Level 3 磨砂）</h2>
      <BaseCard class="p-lg">
        <BaseButton variant="primary" @click="modalOpen = true">打开模态面板</BaseButton>
      </BaseCard>
      <BaseModal :open="modalOpen" title="结束本次阅读" @close="modalOpen = false">
        <p class="text-body-md text-ink-secondary">
          本次阅读《百年孤独》共 42 分钟。记录起止页码与笔记，汇入你的阅读时脉。
        </p>
        <template #footer>
          <div class="flex justify-end gap-sm">
            <BaseButton variant="ghost" @click="modalOpen = false">取消</BaseButton>
            <BaseButton variant="primary" @click="modalOpen = false">保存记录</BaseButton>
          </div>
        </template>
      </BaseModal>
    </section>

    <!-- 空状态 -->
    <section class="mb-2xl">
      <h2 class="mb-md text-headline-sm text-ink-secondary">空状态</h2>
      <BaseCard>
        <BaseEmpty title="书架还是空的" description="去找一本好书，开始你的第一段阅读时脉吧">
          <template #action>
            <BaseButton variant="primary">去发现</BaseButton>
          </template>
        </BaseEmpty>
      </BaseCard>
    </section>

    <!-- 色板 -->
    <section>
      <h2 class="mb-md text-headline-sm text-ink-secondary">色板（随主题切换）</h2>
      <BaseCard class="grid grid-cols-2 gap-md p-lg md:grid-cols-4">
        <div v-for="c in [
          ['paper-base', 'bg-paper-base border border-hairline'],
          ['paper-warm', 'bg-paper-warm border border-hairline'],
          ['paper-elevated', 'bg-paper-elevated border border-hairline'],
          ['pine-deep', 'bg-pine-deep'],
          ['pine-subtle', 'bg-pine-subtle'],
          ['gold-patina', 'bg-gold-patina'],
          ['gold-tint', 'bg-gold-tint border border-hairline'],
          ['ink-primary', 'bg-ink-primary'],
        ]" :key="c[0]" class="flex items-center gap-sm">
          <span class="h-8 w-8 rounded" :class="c[1]" />
          <span class="text-label-md text-ink-secondary">{{ c[0] }}</span>
        </div>
      </BaseCard>
    </section>
  </main>
</template>
