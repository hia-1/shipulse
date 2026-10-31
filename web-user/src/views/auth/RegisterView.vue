<script setup lang="ts">
import { ref, reactive, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { BaseButton, BaseInput } from '@/components/base'

const router = useRouter()
const userStore = useUserStore()

const form = reactive({
  phone: '',
  code: '',
  nickname: '',
})

const errorMsg = ref('')
const countdown = ref(0)
const agreed = ref(false)

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
  startCountdown()
}

async function handleRegister() {
  errorMsg.value = ''
  if (!phoneValid.value) {
    errorMsg.value = '请输入正确的手机号'
    return
  }
  if (!form.code) {
    errorMsg.value = '请输入验证码'
    return
  }
  if (!agreed.value) {
    errorMsg.value = '请先阅读并同意《用户协议》和《隐私政策》'
    return
  }
  try {
    await userStore.register({
      phone: form.phone,
      code: form.code,
      nickname: form.nickname || undefined,
    })
    router.push('/')
  } catch (e) {
    errorMsg.value = (e as Error).message
  }
}
</script>

<template>
  <main class="min-h-screen flex items-center justify-center bg-paper-warm px-md">
    <div class="w-full max-w-sm">
      <div class="text-center mb-xl">
        <h1 class="text-headline-lg-mobile md:text-headline-lg font-serif text-pine-deep">创建账号</h1>
        <p class="text-body-sm text-ink-muted mt-2xs">加入时脉书社，开启阅读之旅</p>
      </div>

      <form
        class="rounded-lg bg-paper-elevated shadow-level-1 border border-hairline p-lg space-y-md"
        @submit.prevent="handleRegister"
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

        <div>
          <label class="text-label-md text-ink-secondary block mb-2xs">昵称（选填）</label>
          <BaseInput
            v-model="form.nickname"
            type="text"
            placeholder="不填则自动生成"
            :maxlength="64"
          />
        </div>

        <label class="flex items-start gap-xs text-body-sm text-ink-secondary cursor-pointer">
          <input
            v-model="agreed"
            type="checkbox"
            class="mt-2xs h-4 w-4 shrink-0 accent-pine-deep"
          />
          <span>
            我已阅读并同意
            <RouterLink to="/terms" class="text-pine-deep hover:underline">《用户协议》</RouterLink>
            和
            <RouterLink to="/privacy" class="text-pine-deep hover:underline">《隐私政策》</RouterLink>
          </span>
        </label>

        <p v-if="errorMsg" class="text-body-sm text-danger">{{ errorMsg }}</p>

        <BaseButton type="submit" class="w-full" :disabled="userStore.loading || !agreed">
          {{ userStore.loading ? '注册中…' : '注 册' }}
        </BaseButton>

        <p class="text-center text-body-sm text-ink-muted">
          已有账号？
          <RouterLink to="/login" class="text-pine-deep hover:underline">去登录</RouterLink>
        </p>
      </form>

      <p class="text-center text-label-sm text-ink-faint mt-lg">
        <RouterLink to="/" class="hover:underline">返回首页</RouterLink>
      </p>
    </div>
  </main>
</template>
