<script setup lang="ts">
/**
 * 分享落地页（P2-05，页面清单第 16 页）
 * 承接微信/站外分享短码：还原分享内容，并引导注册与访问。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { resolveShare, type ShareResolveResult } from '@/api/share'
import { BaseButton, BaseEmpty } from '@/components/base'
import ShareCard from '@/components/share/ShareCard.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const result = ref<ShareResolveResult | null>(null)
const loading = ref(true)
const error = ref('')

const code = computed(() => String(route.params.code ?? ''))
const targetPath = computed(() => result.value?.content.path || '/')

async function load() {
  loading.value = true
  error.value = ''
  result.value = null
  try {
    const res = await resolveShare(code.value)
    result.value = res.data
  } catch (e) {
    error.value = (e as Error).message || '分享链接不存在或已失效'
  } finally {
    loading.value = false
  }
}

function goAccess() {
  if (userStore.isLoggedIn) router.push(targetPath.value)
  else router.push({ path: '/login', query: { redirect: targetPath.value } })
}

onMounted(async () => {
  await userStore.restore()
  await load()
})

watch(code, () => load())
</script>

<template>
  <main class="min-h-screen bg-paper-warm py-xl">
    <div class="mx-auto max-w-container px-md">
      <div class="mx-auto max-w-md">
        <header class="mb-lg text-center">
          <RouterLink to="/" class="font-serif text-title-lg text-pine-deep">
            时脉书社 · 阅读世界
          </RouterLink>
          <p class="mt-2xs text-body-sm text-ink-muted">有人在阅读世界，为你留下一份分享</p>
        </header>

        <div v-if="loading" class="py-xl text-center text-body-md text-ink-muted">
          正在打开分享…
        </div>

        <BaseEmpty v-else-if="error" title="分享不存在或已失效" :description="error" />

        <template v-else-if="result">
          <ShareCard :card="result.card" />

          <section
            class="mt-lg rounded-lg border border-hairline bg-paper-elevated p-lg shadow-level-1"
          >
            <h1 class="font-serif text-headline-sm text-ink-primary">{{ result.content.title }}</h1>
            <p v-if="result.content.subtitle" class="mt-2xs text-label-md text-ink-muted">
              {{ result.content.subtitle }}
            </p>
            <p
              v-if="result.content.description"
              class="mt-sm whitespace-pre-line text-body-md leading-relaxed text-ink-secondary"
            >
              {{ result.content.description }}
            </p>

            <div v-if="result.content.stats.length" class="mt-md grid grid-cols-2 gap-sm">
              <div
                v-for="s in result.content.stats"
                :key="s.label"
                class="rounded border border-hairline px-sm py-xs"
              >
                <p class="text-label-sm text-ink-muted">{{ s.label }}</p>
                <p class="mt-[2px] font-serif text-title-lg text-pine-deep tabular-nums">
                  {{ s.value }}
                </p>
              </div>
            </div>

            <div class="mt-lg flex flex-col gap-sm">
              <BaseButton class="w-full" @click="goAccess">
                {{ userStore.isLoggedIn ? '前往查看' : '登录后查看' }}
              </BaseButton>
              <BaseButton
                v-if="!userStore.isLoggedIn"
                variant="ghost"
                class="w-full"
                @click="router.push('/register')"
              >
                没有账号？立即注册
              </BaseButton>
              <p class="text-center text-label-sm text-ink-faint">
                在时脉书社，记录每一次阅读的脉动
              </p>
            </div>
          </section>

          <p class="mt-lg text-center text-label-sm text-ink-faint">
            <RouterLink to="/" class="hover:underline">返回首页</RouterLink>
          </p>
        </template>
      </div>
    </div>
  </main>
</template>
