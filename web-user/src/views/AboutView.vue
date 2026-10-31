<script setup lang="ts">
interface Value {
  title: string
  desc: string
}

const values: Value[] = [
  { title: '记录', desc: '让每一次翻页、每一段阅读都被如实记录，形成属于你的阅读轨迹。' },
  { title: '看见', desc: '用「时脉」把零散的阅读时间可视化，看见坚持，也看见节奏。' },
  { title: '同频', desc: '通过书评、动态与书单，与同样在阅读的人相遇、交流、共鸣。' },
]

interface Feature {
  name: string
  desc: string
}

const features: Feature[] = [
  { name: '书库与找书', desc: '分类书城、搜索联想与榜单推荐，帮你更快找到想读的书。' },
  { name: '书架与阅读计时', desc: '三态书架管理，全站悬浮计时器，阅读时长自动沉淀。' },
  { name: '时脉报告', desc: '热力图与折线图呈现阅读节奏，支持年度盘点与数据导出。' },
  { name: '书评与社区', desc: '半星评分、图文书评、评论点赞与动态流，分享阅读所得。' },
  { name: '书单体系', desc: '创建与收藏书单，把好书按主题整理与分享。' },
  { name: '会员增值服务', desc: '时脉数据导出、会员专属活动等增值权益。' },
]
</script>

<template>
  <main class="min-h-screen bg-paper-warm py-xl">
    <div class="mx-auto max-w-2xl px-md">
      <RouterLink to="/" class="text-body-sm text-ink-muted hover:text-pine-deep">← 返回首页</RouterLink>

      <section class="mt-md text-center">
        <h1 class="font-serif text-headline-lg-mobile text-pine-deep md:text-headline-lg">关于时脉书社</h1>
        <p class="mt-sm text-body-md text-ink-secondary">阅读世界 · 让每一次阅读被看见</p>
      </section>

      <section class="mt-xl rounded-lg border border-hairline bg-paper-elevated p-lg shadow-level-1">
        <h2 class="text-title-lg text-ink-primary">我们是谁</h2>
        <p class="mt-sm text-body-md leading-relaxed text-ink-secondary">
          时脉书社是一个以「阅读记录」为核心的阅读社区。我们相信，阅读不只是翻过多少页，更是一段可以被看见的时间。
          因此我们把阅读计时、书架管理与时脉可视化放在一起，让坚持有迹可循；再通过书评、书单与动态流，把阅读的收获分享给同频的人。
        </p>
      </section>

      <section class="mt-lg grid gap-md sm:grid-cols-3">
        <div
          v-for="v in values"
          :key="v.title"
          class="rounded-lg border border-hairline bg-paper-elevated p-md shadow-level-1"
        >
          <h3 class="font-serif text-title-md text-pine-deep">{{ v.title }}</h3>
          <p class="mt-xs text-body-sm leading-relaxed text-ink-secondary">{{ v.desc }}</p>
        </div>
      </section>

      <section class="mt-xl">
        <h2 class="text-title-lg text-ink-primary">核心功能</h2>
        <ul class="mt-sm grid gap-sm sm:grid-cols-2">
          <li
            v-for="f in features"
            :key="f.name"
            class="rounded-lg border border-hairline bg-paper-elevated p-md shadow-level-1"
          >
            <h3 class="text-title-md text-ink-primary">{{ f.name }}</h3>
            <p class="mt-xs text-body-sm leading-relaxed text-ink-secondary">{{ f.desc }}</p>
          </li>
        </ul>
      </section>

      <section class="mt-xl rounded-lg border border-hairline bg-paper-elevated p-lg shadow-level-1">
        <h2 class="text-title-lg text-ink-primary">联系我们</h2>
        <p class="mt-sm text-body-sm text-ink-secondary">
          产品建议、问题反馈或合作洽谈，欢迎通过以下渠道联系我们。
        </p>
        <div class="mt-md flex flex-wrap gap-sm">
          <RouterLink
            to="/feedback"
            class="rounded bg-pine-deep px-md py-sm text-label-md text-paper-elevated transition-colors hover:bg-pine-hover"
          >意见反馈</RouterLink>
          <RouterLink
            to="/help"
            class="rounded border border-hairline px-md py-sm text-label-md text-ink-secondary transition-colors hover:border-border-muted"
          >帮助中心</RouterLink>
        </div>
        <div class="mt-md flex flex-wrap gap-md text-body-sm text-ink-muted">
          <RouterLink to="/privacy" class="hover:text-pine-deep">隐私政策</RouterLink>
          <RouterLink to="/terms" class="hover:text-pine-deep">用户协议</RouterLink>
        </div>
      </section>

      <p class="mt-xl text-center text-label-sm text-ink-faint">© 2026 时脉书社 · 阅读世界</p>
    </div>
  </main>
</template>
