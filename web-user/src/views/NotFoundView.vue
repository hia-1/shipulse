<script setup lang="ts">
import { useRouter } from 'vue-router'
import { BaseButton, BaseEmpty } from '@/components/base'

const router = useRouter()
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center px-lg">
    <BaseEmpty title="页面不存在" description="你访问的页面不存在或已搬家，回到首页继续阅读吧">
      <template #icon>🔍</template>
      <template #action>
        <BaseButton variant="primary" @click="router.push('/')">回到首页</BaseButton>
      </template>
    </BaseEmpty>
  </div>
</template>