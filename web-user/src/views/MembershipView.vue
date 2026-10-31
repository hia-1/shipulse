<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { BaseButton, BaseModal, BaseInput } from '@/components/base'
import {
  getMyStatus,
  createOrder,
  sandboxPay,
  trial as apiTrial,
  redeem as apiRedeem,
  type MyStatus,
  type Plan,
} from '@/api/membership'

const userStore = useUserStore()

const status = ref<MyStatus | null>(null)
const loading = ref(true)
const loadError = ref('')
const toast = ref('')
const toastError = ref(false)

// 购买弹窗
const payOpen = ref(false)
const payPlan = ref<Plan | null>(null)
const autoRenew = ref(false)
const paying = ref(false)
const payError = ref('')

// 兑换码
const redeemInput = ref('')
const redeemBusy = ref(false)

// 试用
const trialing = ref(false)

async function refresh() {
  loadError.value = ''
  try {
    const res = await getMyStatus()
    status.value = res.data
  } catch (e) {
    status.value = null
    loadError.value = (e as Error).message || '会员信息加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

function flash(msg: string, error = false) {
  toast.value = msg
  toastError.value = error
  setTimeout(() => {
    if (toast.value === msg) toast.value = ''
  }, 2600)
}

function openPay(plan: Plan) {
  payPlan.value = plan
  autoRenew.value = false
  payError.value = ''
  payOpen.value = true
}

async function confirmPay() {
  if (!payPlan.value) return
  paying.value = true
  payError.value = ''
  try {
    const order = await createOrder({
      planId: payPlan.value.id,
      autoRenew: autoRenew.value,
    })
    const pay = await sandboxPay(order.data.orderNo)
    await refresh()
    await userStore.fetchProfile()
    payOpen.value = false
    flash(`开通成功，会员有效期至 ${new Date(pay.data.memberExpireAt!).toLocaleDateString('zh-CN')}`)
  } catch (e) {
    payError.value = (e as Error).message || '支付失败'
  } finally {
    paying.value = false
  }
}

async function handleTrial() {
  trialing.value = true
  try {
    const res = await apiTrial()
    await refresh()
    await userStore.fetchProfile()
    flash(`已开通 7 天试用，有效期至 ${new Date(res.data.expireTime).toLocaleDateString('zh-CN')}`)
  } catch (e) {
    flash((e as Error).message || '试用失败', true)
  } finally {
    trialing.value = false
  }
}

async function handleRedeem() {
  const code = redeemInput.value.trim()
  if (!code) {
    flash('请输入兑换码', true)
    return
  }
  redeemBusy.value = true
  try {
    const res = await apiRedeem(code)
    await refresh()
    await userStore.fetchProfile()
    redeemInput.value = ''
    flash(`兑换成功，会员有效期至 ${new Date(res.data.expireTime).toLocaleDateString('zh-CN')}`)
  } catch (e) {
    flash((e as Error).message || '兑换失败', true)
  } finally {
    redeemBusy.value = false
  }
}

const benefitRows = computed(() => {
  const set = new Set<string>()
  status.value?.plans.forEach((p) => p.benefits.forEach((b) => set.add(b)))
  return [...set]
})

function yuan(fen: number) {
  return (fen / 100).toFixed(0 === fen % 100 ? 0 : 2).replace(/\.0+$/, '')
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('zh-CN')
}

function hasSubscribed() {
  // 依据订单存在与否由后端判定；这里用 status 表示可试用状态
  return status.value?.isMember
}

const faqs = [
  { q: '自动续费如何取消？', a: '订单开通时可选自动续费；已开启的订阅到期时会自动扣款续期，可在下一次续费前联系取消。' },
  { q: '试用可以用几次？', a: '每位注册用户限一次 7 天免费试用，与已下过的订阅订单互斥，防止重复领取。' },
  { q: '兑换码是永久的吗？', a: '兑换码由运营生成，缀有有效期与套餐，采用一次性核销，重复使用会报错。' },
  { q: '会员到期后数据会丢失吗？', a: '不会。到期后保留你的时脉、书架与书评数据，仅会员专属权益（如数据导出）暂停，续费后自动恢复。' },
]

onMounted(async () => {
  await refresh()
})
</script>

<template>
  <main class="min-h-screen bg-paper-warm py-xl">
    <div class="max-w-container mx-auto px-md">
      <div class="max-w-md mx-auto space-y-lg">
        <h1 class="text-headline-lg-mobile md:text-headline-lg font-serif text-pine-deep">会员中心</h1>

        <!-- 加载骨架屏 -->
        <div v-if="loading" class="animate-pulse space-y-lg">
          <div class="h-24 rounded-lg bg-paper-elevated"></div>
          <div class="h-6 w-24 rounded bg-paper-elevated"></div>
          <div class="h-40 rounded-lg bg-paper-elevated"></div>
        </div>

        <!-- 加载失败提示 -->
        <div
          v-if="loadError"
          class="rounded-lg border border-danger/30 bg-danger/5 p-md text-body-sm text-danger"
        >
          <p>{{ loadError }}</p>
          <BaseButton variant="ghost" class="mt-sm" @click="refresh">重试</BaseButton>
        </div>

        <!-- 顶部提示 -->
        <Transition name="fade">
          <div
            v-if="toast"
            class="rounded-lg border p-md text-body-sm"
            :class="toastError ? 'border-danger/30 bg-danger/5 text-danger' : 'border-pine-deep/30 bg-pine-subtle text-pine-deep'"
          >
            {{ toast }}
          </div>
        </Transition>

        <!-- 会员状态卡 -->
        <div
          v-if="!loading"
          class="rounded-lg border p-lg shadow-level-1"
          :class="status?.isMember ? 'bg-paper-elevated border-gold-patina/40' : 'bg-paper-elevated border-hairline'"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-title-lg font-serif text-ink-primary">
                {{ status?.isMember ? '已开通会员' : '尚未开通会员' }}
              </p>
              <p class="text-body-sm text-ink-muted mt-1">
                <template v-if="status?.isMember">
                  有效期至 {{ fmtDate(status.memberExpireAt) }}
                  <span v-if="status.subscription?.autoRenew" class="text-gold-patina"> · 自动续费中</span>
                </template>
                <template v-else>开通即可享受深度时脉报告、数据导出等专属权益</template>
              </p>
            </div>
            <span
              v-if="status?.isMember"
              class="shrink-0 rounded-full bg-gold-tint px-3 py-1 text-label-md text-gold-patina"
            >{{ status.subscription?.planName }}</span>
          </div>
        </div>

        <!-- 套餐卡片 -->
        <section v-if="!loading">
          <h2 class="text-title-lg text-ink-primary mb-md">选择套餐</h2>
          <div class="grid grid-cols-1 gap-md">
            <div
              v-for="p in status?.plans ?? []"
              :key="p.id"
              class="flex flex-col rounded-lg border border-hairline bg-paper-elevated shadow-level-1 p-lg"
              :class="p.code === 'yearly' ? 'border-gold-patina/50' : ''"
            >
              <div class="flex items-start justify-between">
                <div>
                  <p class="text-title-md text-ink-primary">{{ p.name }}</p>
                  <p class="text-body-sm text-ink-muted mt-0.5">{{ p.description }}</p>
                </div>
                <span v-if="p.code === 'yearly'" class="shrink-0 rounded bg-gold-tint px-2 py-0.5 text-label-sm text-gold-patina">最划算</span>
              </div>

              <div class="mt-md flex items-baseline gap-xs">
                <span class="text-headline-md font-serif text-pine-deep">¥{{ yuan(p.priceFen) }}</span>
                <template v-if="p.originalPriceFen > p.priceFen">
                  <span class="text-body-sm text-ink-muted line-through">¥{{ yuan(p.originalPriceFen) }}</span>
                  <span class="text-label-sm text-gold-patina">省 {{ Math.round((1 - p.priceFen / p.originalPriceFen) * 100) }}%</span>
                </template>
              </div>

              <ul class="mt-md space-y-xs">
                <li v-for="b in p.benefits" :key="b" class="flex items-center gap-xs text-body-sm text-ink-secondary">
                  <span class="text-pine-deep">✓</span>{{ b }}
                </li>
              </ul>

              <BaseButton class="mt-lg w-full" @click="openPay(p)">立即开通</BaseButton>
            </div>
          </div>
        </section>

        <!-- 试用（非会员可见） -->
        <div v-if="!loading && !hasSubscribed()" class="rounded-lg border border-hairline bg-paper-elevated p-lg shadow-level-1">
          <p class="text-title-md text-ink-primary">免费试用</p>
          <p class="text-body-sm text-ink-muted mt-0.5">每位用户可领取一次 7 天免费会员体验全部权益</p>
          <BaseButton variant="ghost" class="mt-md w-full" :disabled="trialing" @click="handleTrial">
            {{ trialing ? '开通中…' : '领取 7 天试用' }}
          </BaseButton>
        </div>

        <!-- 兑换码（始终可见，会员亦可续期） -->
        <div class="rounded-lg border border-hairline bg-paper-elevated p-lg shadow-level-1">
          <p class="text-title-md text-ink-primary">兑换码</p>
          <p class="text-body-sm text-ink-muted mt-0.5">输入兑换码可开通或延长会员有效期</p>
          <div class="mt-md flex gap-sm">
            <BaseInput v-model="redeemInput" placeholder="输入兑换码" class="flex-1" />
            <BaseButton variant="ghost" :disabled="redeemBusy" @click="handleRedeem">
              {{ redeemBusy ? '兑换中…' : '兑换' }}
            </BaseButton>
          </div>
        </div>

        <!-- 权益对比 -->
        <section class="rounded-lg border border-hairline bg-paper-elevated overflow-hidden shadow-level-1">
          <p class="px-lg pt-lg text-title-md text-ink-primary">权益对比</p>
          <table class="w-full mt-md text-body-sm">
            <thead>
              <tr class="border-y border-hairline text-left text-ink-muted">
                <th class="px-lg py-sm font-medium">权益</th>
                <th class="px-lg py-sm font-medium text-center">会员</th>
                <th class="px-lg py-sm font-medium text-center">免费</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="b in benefitRows" :key="b" class="border-b border-hairline last:border-0">
                <td class="px-lg py-sm text-ink-primary">{{ b }}</td>
                <td class="px-lg py-sm text-center text-pine-deep">✓</td>
                <td class="px-lg py-sm text-center text-ink-faint">{{ b === '深度时脉报告与数据导出' ? '—' : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- FAQ -->
        <section>
          <h2 class="text-title-lg text-ink-primary mb-md">常见问题</h2>
          <div class="space-y-sm">
            <details v-for="f in faqs" :key="f.q" class="rounded-lg border border-hairline bg-paper-elevated px-lg py-sm shadow-level-1">
              <summary class="cursor-pointer text-body-md text-ink-primary list-none marker:hidden select-none">{{ f.q }}</summary>
              <p class="text-body-sm text-ink-muted mt-sm leading-relaxed">{{ f.a }}</p>
            </details>
          </div>
        </section>
      </div>
    </div>

    <!-- 购买弹窗 -->
    <BaseModal :open="payOpen" :title="`确认开通 · ${payPlan?.name}`" @close="payOpen = false">
      <form class="space-y-md" @submit.prevent="confirmPay">
        <div class="rounded border border-hairline bg-paper-warm p-md text-body-sm text-ink-secondary space-y-xs">
          <p class="flex justify-between"><span>套餐</span><span class="text-ink-primary">{{ payPlan?.name }}</span></p>
          <p class="flex justify-between"><span>价格</span><span class="text-pine-deep font-medium">¥{{ yuan(payPlan?.priceFen ?? 0) }}</span></p>
          <p class="flex justify-between"><span>时长</span><span class="text-ink-primary">{{ payPlan?.durationDays }} 天</span></p>
        </div>

        <label class="flex items-center gap-sm cursor-pointer select-none">
          <input v-model="autoRenew" type="checkbox" class="h-4 w-4 accent-pine-deep" />
          <span class="text-body-sm text-ink-secondary">开启自动续费，到期自动扣款续期</span>
        </label>

        <p v-if="payError" class="text-body-sm text-danger">{{ payError }}</p>
        <p class="text-body-sm text-ink-muted">当前为沙箱环境，点击确认将模拟微信支付即时开通。</p>

        <div class="flex gap-sm">
          <BaseButton variant="ghost" class="flex-1" type="button" @click="payOpen = false">取消</BaseButton>
          <BaseButton class="flex-1" type="submit" :disabled="paying">{{ paying ? '支付中…' : '确认支付' }}</BaseButton>
        </div>
      </form>
    </BaseModal>
  </main>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
summary::marker {
  display: none;
}
</style>