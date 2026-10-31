<script setup lang="ts">
import { ref, reactive, computed, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { BaseButton, BaseInput } from '@/components/base'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const form = reactive({
  phone: '',
  code: '',
})

const errorMsg = ref('')
const countdown = ref(0)

const phoneValid = computed(() => /^1[3-9]\d{9}$/.test(form.phone))

let timer: ReturnType<typeof setInterval> | null = null

function startCountdown() {
  if (timer) clearInterval(timer)
  countdown.value = 60
  timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(timer as ReturnType<typeof setInterval>)
      timer = null
    }
  }, 1000)
}

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

function sendCode() {
  if (!phoneValid.value) {
    errorMsg.value = '请输入正确的手机号'
    return
  }
  errorMsg.value = ''
  // dev 环境：验证码固定 123456，无需调后端发送
  startCountdown()
}

async function handleLogin() {
  errorMsg.value = ''
  if (!phoneValid.value) {
    errorMsg.value = '请输入正确的手机号'
    return
  }
  if (!form.code) {
    errorMsg.value = '请输入验证码'
    return
  }
  try {
    await userStore.login({ phone: form.phone, code: form.code })
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  } catch (e) {
    errorMsg.value = (e as Error).message
  }
}
</script>

<template>
  <main class="min-h-screen flex items-center justify-center bg-paper-warm px-md">
    <div class="w-full max-w-sm">
      <div class="text-center mb-xl">
        <h1 class="text-headline-lg-mobile md:text-headline-lg font-serif text-pine-deep">时脉书社</h1>
        <p class="text-body-sm text-ink-muted mt-2xs">记录每一次阅读的脉动</p>
      </div>

      <form
        class="rounded-lg bg-paper-elevated shadow-level-1 border border-hairline p-lg space-y-md"
        @submit.prevent="handleLogin"
      >
        <div>
          <label class="text-label-md text-ink-secondary block mb-2xs">手机号</label>
          <BaseInput
            v-model="form.phone"
            type="tel"
            placeholder="请输入手机号"
            :maxlength="11"
          />
        </div>

        <div>
          <label class="text-label-md text-ink-secondary block mb-2xs">验证码</label>
          <div class="flex gap-xs">
            <BaseInput
              v-model="form.code"
              type="text"
              placeholder="6 位验证码"
              :maxlength="6"
              class="flex-1"
            />
            <BaseButton
              variant="ghost"
              :disabled="countdown > 0 || !phoneValid"
              @click="sendCode"
            >
              {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
            </BaseButton>
          </div>
          <p class="text-label-sm text-ink-faint mt-2xs">dev 环境验证码固定为 123456</p>
        </div>

        <p v-if="errorMsg" class="text-body-sm text-danger">{{ errorMsg }}</p>

        <BaseButton type="submit" class="w-full" :disabled="userStore.loading">
          {{ userStore.loading ? '登录中…' : '登 录' }}
        </BaseButton>

        <p class="text-center text-body-sm text-ink-muted">
          还没有账号？
          <RouterLink to="/register" class="text-pine-deep hover:underline">立即注册</RouterLink>
        </p>
      </form>

      <p class="text-center text-label-sm text-ink-faint mt-lg">
        <RouterLink to="/" class="hover:underline">返回首页</RouterLink>
      </p>
    </div>
  </main>
</template>
