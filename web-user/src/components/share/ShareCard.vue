<script setup lang="ts">
/**
 * 分享卡片（P2-05）
 * 三类模板：review 书评金句 / booklist 书单 / pulse 时脉
 * 视觉为品牌松绿底 + 铜青金点缀；同时提供 Canvas 绘图导出 PNG（供保存/转发）
 */
import { computed } from 'vue'
import type { ShareCardPayload } from '@/api/share'

const props = defineProps<{
  card: ShareCardPayload
}>()

const BRAND = {
  bgTop: '#2D4A43',
  bgBottom: '#16241F',
  gold: '#C29B38',
}

const templateLabel = computed(
  () => ({ pulse: '时脉', booklist: '书单', review: '书评' })[props.card.template] ?? '分享',
)

const stars = computed(() => {
  const full = Math.max(0, Math.min(5, Math.round(props.card.rating ?? 0)))
  return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full)
})

// ---------- Canvas 导出 ----------

const CANVAS_W = 750
const CANVAS_H = 1000

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!url) return resolve(null)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const timer = window.setTimeout(() => resolve(null), 4000)
    img.onload = () => {
      window.clearTimeout(timer)
      resolve(img)
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      resolve(null)
    }
    img.src = url
  })
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = []
  let line = ''
  for (const ch of text) {
    if (ch === '\n') {
      lines.push(line)
      line = ''
      if (lines.length >= maxLines) return lines
      continue
    }
    const test = line + ch
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line)
      line = ch
      if (lines.length >= maxLines) return lines
    } else {
      line = test
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  return lines
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const ir = img.width / img.height
  const br = w / h
  let sw = img.width
  let sh = img.height
  let sx = 0
  let sy = 0
  if (ir > br) {
    sw = img.height * br
    sx = (img.width - sw) / 2
  } else {
    sh = img.width / br
    sy = (img.height - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

/** 将当前卡片绘制为 PNG（dataURL），供下载保存 */
async function toDataURL(): Promise<string> {
  const card = props.card
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前环境不支持导出图片')

  const [cover, avatar] = await Promise.all([
    loadImage(card.coverUrl),
    loadImage(card.author.avatarUrl),
  ])

  // 背景
  const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
  bg.addColorStop(0, BRAND.bgTop)
  bg.addColorStop(1, BRAND.bgBottom)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  const glow = ctx.createRadialGradient(CANVAS_W, 0, 40, CANVAS_W, 0, 480)
  glow.addColorStop(0, 'rgba(194,155,56,0.34)')
  glow.addColorStop(1, 'rgba(194,155,56,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  const pad = 56
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  // 品牌行
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.font = '500 28px "Noto Serif SC", serif'
  ctx.fillText('时脉书社', pad, pad + 20)
  ctx.textAlign = 'right'
  ctx.font = '500 22px Inter, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillText(templateLabel.value, CANVAS_W - pad, pad + 18)
  ctx.textAlign = 'left'
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(pad, pad + 44)
  ctx.lineTo(CANVAS_W - pad, pad + 44)
  ctx.stroke()

  const top = pad + 100
  const coverW = 176
  const coverH = 234
  let textLeft = pad
  if (cover) {
    ctx.save()
    roundRect(ctx, pad, top, coverW, coverH, 10)
    ctx.clip()
    drawCover(ctx, cover, pad, top, coverW, coverH)
    ctx.restore()
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'
    roundRect(ctx, pad, top, coverW, coverH, 10)
    ctx.stroke()
    textLeft = pad + coverW + 32
  }
  const textWidth = CANVAS_W - pad - textLeft

  let ty = top + 34
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '600 42px "Noto Serif SC", serif'
  for (const l of wrapLines(ctx, card.title, textWidth, 2)) {
    ctx.fillText(l, textLeft, ty)
    ty += 52
  }
  if (card.subtitle) {
    ctx.fillStyle = 'rgba(255,255,255,0.72)'
    ctx.font = '400 24px Inter, sans-serif'
    for (const l of wrapLines(ctx, card.subtitle, textWidth, 2)) {
      ctx.fillText(l, textLeft, ty)
      ty += 34
    }
  }
  if (card.rating) {
    ctx.fillStyle = BRAND.gold
    ctx.font = '400 28px Inter, sans-serif'
    ctx.fillText(`${stars.value} ${card.rating.toFixed(1)}`, textLeft, ty + 10)
  }

  // 金句
  let by = Math.max(top + coverH, ty + 10) + 66
  if (card.quote) {
    ctx.font = '400 30px "Noto Serif SC", serif'
    const qLines = wrapLines(ctx, card.quote, CANVAS_W - pad * 2 - 30, 5)
    const lineH = 46
    ctx.fillStyle = BRAND.gold
    ctx.fillRect(pad, by - 32, 4, qLines.length * lineH - 12)
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    for (const l of qLines) {
      ctx.fillText(l, pad + 30, by)
      by += lineH
    }
  }

  // 统计
  if (card.stats.length) {
    const gap = 20
    const cellW = (CANVAS_W - pad * 2 - gap) / 2
    const cellH = 78
    const statsY = CANVAS_H - pad - 250
    card.stats.forEach((s, i) => {
      const x = pad + (i % 2) * (cellW + gap)
      const y = statsY + Math.floor(i / 2) * (cellH + 16)
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      roundRect(ctx, x, y, cellW, cellH, 12)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.62)'
      ctx.font = '400 20px Inter, sans-serif'
      ctx.fillText(s.label, x + 20, y + 32)
      ctx.fillStyle = '#FFFFFF'
      ctx.font = '600 30px "Noto Serif SC", serif'
      ctx.fillText(s.value, x + 20, y + 66)
    })
  }

  // 页脚
  const footLineY = CANVAS_H - pad - 46
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.beginPath()
  ctx.moveTo(pad, footLineY)
  ctx.lineTo(CANVAS_W - pad, footLineY)
  ctx.stroke()

  const footY = CANVAS_H - pad - 12
  let ax = pad
  if (avatar) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(pad + 18, footY - 12, 18, 0, Math.PI * 2)
    ctx.clip()
    drawCover(ctx, avatar, pad, footY - 30, 36, 36)
    ctx.restore()
    ax = pad + 48
  }
  ctx.fillStyle = 'rgba(255,255,255,0.88)'
  ctx.font = '500 24px Inter, sans-serif'
  ctx.fillText(card.author.nickname, ax, footY - 4)
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '400 20px Inter, sans-serif'
  ctx.fillText(card.footer, CANVAS_W - pad, footY - 4)
  ctx.textAlign = 'left'

  return canvas.toDataURL('image/png')
}

defineExpose({ toDataURL })
</script>

<template>
  <div class="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-pine-deep text-paper-elevated">
    <div class="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold-patina/25 blur-3xl" />
    <div class="pointer-events-none absolute -bottom-20 -left-16 h-52 w-52 rounded-full bg-white/5 blur-3xl" />

    <div class="relative flex h-full flex-col p-lg">
      <!-- 品牌行 -->
      <div class="flex items-center justify-between">
        <span class="font-serif text-label-md tracking-widest text-paper-elevated/90">时脉书社</span>
        <span class="rounded-full border border-white/25 px-2xs py-[2px] text-label-sm text-paper-elevated/80">
          {{ templateLabel }}
        </span>
      </div>
      <div class="mt-sm h-px bg-white/15" />

      <!-- 主体 -->
      <div class="mt-md flex min-h-0 flex-1 flex-col">
        <div class="flex gap-md">
          <div
            v-if="card.coverUrl"
            class="h-28 w-20 shrink-0 overflow-hidden rounded border border-white/15"
          >
            <img
              :src="card.coverUrl"
              :alt="card.title"
              crossorigin="anonymous"
              class="h-full w-full object-cover"
            />
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="line-clamp-2 font-serif text-headline-sm leading-snug text-paper-elevated">
              {{ card.title }}
            </h3>
            <p
              v-if="card.subtitle"
              class="mt-2xs line-clamp-2 text-label-md text-paper-elevated/70"
            >
              {{ card.subtitle }}
            </p>
            <p v-if="card.rating" class="mt-xs text-label-md text-gold-patina tabular-nums">
              {{ stars }} {{ card.rating.toFixed(1) }}
            </p>
          </div>
        </div>

        <blockquote
          v-if="card.quote"
          class="mt-md line-clamp-5 border-l-2 border-gold-patina pl-sm font-serif text-body-md leading-relaxed text-paper-elevated/95"
        >
          {{ card.quote }}
        </blockquote>

        <div v-if="card.stats.length" class="mt-auto grid grid-cols-2 gap-sm pt-md">
          <div v-for="s in card.stats" :key="s.label" class="rounded bg-white/10 px-sm py-xs">
            <p class="text-label-sm text-paper-elevated/60">{{ s.label }}</p>
            <p class="mt-[2px] font-serif text-title-lg text-paper-elevated tabular-nums">
              {{ s.value }}
            </p>
          </div>
        </div>

        <!-- 作者 + 页脚 -->
        <div class="mt-md flex items-center justify-between border-t border-white/15 pt-sm">
          <div class="flex min-w-0 items-center gap-xs">
            <img
              v-if="card.author.avatarUrl"
              :src="card.author.avatarUrl"
              :alt="card.author.nickname"
              crossorigin="anonymous"
              class="h-6 w-6 shrink-0 rounded-full object-cover"
            />
            <span class="truncate text-label-md text-paper-elevated/85">
              {{ card.author.nickname }}
            </span>
          </div>
          <span class="shrink-0 text-label-sm text-paper-elevated/50">{{ card.footer }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
