<script setup lang="ts">
import { computed, ref } from 'vue'

interface Faq {
  q: string
  a: string
}

interface FaqGroup {
  category: string
  items: Faq[]
}

const groups: FaqGroup[] = [
  {
    category: '账号与登录',
    items: [
      {
        q: '如何注册时脉书社账号？',
        a: '在登录页点击「注册」，使用手机号获取验证码并设置密码即可完成注册。注册即表示你已阅读并同意《用户协议》与《隐私政策》。',
      },
      {
        q: '忘记密码怎么办？',
        a: '在登录页选择「忘记密码」，通过注册手机号接收验证码后即可重置密码。',
      },
      {
        q: '如何注销账号？',
        a: '进入「个人中心 → 注销账号」提交申请。注销后账号将无法登录，相关数据将被删除或匿名化处理，请谨慎操作。',
      },
    ],
  },
  {
    category: '阅读与计时',
    items: [
      {
        q: '如何记录阅读时长？',
        a: '进入「书房」开始阅读计时，页面右下角的悬浮计时器会在全站保持运行。结束计时后本次阅读会写入你的阅读记录，并汇总到时脉报告。',
      },
      {
        q: '时脉报告是什么？',
        a: '时脉报告以热力图与折线图呈现你的阅读节奏，包括每日时长、连续打卡与年度盘点。会员还可导出 CSV 数据。',
      },
      {
        q: '书架上的三种状态有什么区别？',
        a: '「想读」用于收藏待读，「在读」记录当前阅读进度，「读完」沉淀已完成的书籍。你可以在书架页按状态筛选。',
      },
    ],
  },
  {
    category: '书评与社区',
    items: [
      {
        q: '如何发表书评？',
        a: '在书籍详情页点击「写书评」，支持半星评分与图文内容。提交后经机器审核，通过后展示在书评区与动态流。',
      },
      {
        q: '内容为什么会被下架？',
        a: '平台对内容实行机器审核与人工审核。若内容违反《用户协议》中的行为规范（如广告、侵权、不良信息），将被驳回或下架。如你认为是误判，可提交申诉。',
      },
      {
        q: '如何举报违规内容？',
        a: '在书评、动态、评论、书单或用户主页点击「举报」，选择原因并提交。我们会尽快核实并处理。',
      },
    ],
  },
  {
    category: '会员与支付',
    items: [
      {
        q: '会员有哪些权益？',
        a: '会员可享受时脉数据导出、会员专属活动报名、身份标识等增值权益，具体以会员中心页面说明为准。',
      },
      {
        q: '兑换码如何使用？',
        a: '在「会员中心」选择「兑换码」入口，输入有效兑换码即可开通对应权益。兑换码为一次性核销凭证，一经使用不可退回。',
      },
      {
        q: '自动续费如何关闭？',
        a: '在会员中心可查看续费状态并关闭自动续费。关闭后当前周期到期不再自动扣费。',
      },
    ],
  },
  {
    category: '隐私与安全',
    items: [
      {
        q: '平台会收集哪些信息？',
        a: '我们仅收集提供服务所必需的信息，包括账号信息、使用信息与设备日志信息。详细说明请查看《隐私政策》。',
      },
      {
        q: '我的个人信息安全吗？',
        a: '全站使用 HTTPS 传输，敏感信息脱敏展示，访问权限最小化，数据库每日备份。我们不会向第三方出售你的个人信息。',
      },
    ],
  },
]

const keyword = ref('')
const openKey = ref('')

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return groups
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (it) => it.q.toLowerCase().includes(kw) || it.a.toLowerCase().includes(kw),
      ),
    }))
    .filter((g) => g.items.length > 0)
})

function key(group: string, index: number) {
  return `${group}-${index}`
}

function toggle(group: string, index: number) {
  const k = key(group, index)
  openKey.value = openKey.value === k ? '' : k
}
</script>

<template>
  <main class="min-h-screen bg-paper-warm py-xl">
    <div class="mx-auto max-w-2xl px-md">
      <RouterLink to="/" class="text-body-sm text-ink-muted hover:text-pine-deep">← 返回首页</RouterLink>
      <h1 class="mt-md font-serif text-headline-lg-mobile text-pine-deep md:text-headline-lg">帮助中心</h1>
      <p class="mt-2xs text-body-sm text-ink-muted">常见问题解答，快速找到你需要的答案。</p>

      <div class="mt-lg">
        <input
          v-model="keyword"
          type="search"
          placeholder="搜索问题关键词，如「计时」「会员」"
          class="w-full rounded border border-hairline bg-paper-elevated px-sm py-sm text-body-md text-ink-primary placeholder:text-ink-muted transition-shadow focus:border-pine-deep focus:outline-none focus:ring-[3px] focus:ring-pine-deep/[0.08]"
        />
      </div>

      <div v-if="!filtered.length" class="mt-lg rounded-lg border border-hairline bg-paper-elevated p-lg text-center text-body-sm text-ink-muted">
        没有找到相关问题，可前往
        <RouterLink to="/feedback" class="text-pine-deep hover:underline">意见反馈</RouterLink>
        告诉我们。
      </div>

      <section v-for="g in filtered" :key="g.category" class="mt-lg">
        <h2 class="text-title-md text-ink-primary">{{ g.category }}</h2>
        <ul class="mt-sm space-y-2xs">
          <li
            v-for="(it, i) in g.items"
            :key="it.q"
            class="overflow-hidden rounded-lg border border-hairline bg-paper-elevated shadow-level-1"
          >
            <button
              type="button"
              class="flex w-full items-center justify-between gap-sm px-md py-sm text-left"
              @click="toggle(g.category, i)"
            >
              <span class="text-body-md text-ink-primary">{{ it.q }}</span>
              <span class="shrink-0 text-ink-muted">{{ openKey === key(g.category, i) ? '−' : '+' }}</span>
            </button>
            <div
              v-if="openKey === key(g.category, i)"
              class="border-t border-hairline px-md py-sm text-body-sm leading-relaxed text-ink-secondary"
            >
              {{ it.a }}
            </div>
          </li>
        </ul>
      </section>

      <section class="mt-xl rounded-lg border border-hairline bg-paper-elevated p-lg text-center shadow-level-1">
        <p class="text-body-md text-ink-primary">没有解决你的问题？</p>
        <p class="mt-2xs text-body-sm text-ink-muted">通过意见反馈告诉我们，我们会尽快跟进。</p>
        <div class="mt-md flex flex-wrap justify-center gap-sm">
          <RouterLink
            to="/feedback"
            class="rounded bg-pine-deep px-md py-sm text-label-md text-paper-elevated transition-colors hover:bg-pine-hover"
          >意见反馈</RouterLink>
          <RouterLink
            to="/about"
            class="rounded border border-hairline px-md py-sm text-label-md text-ink-secondary transition-colors hover:border-border-muted"
          >关于我们</RouterLink>
        </div>
      </section>
    </div>
  </main>
</template>
