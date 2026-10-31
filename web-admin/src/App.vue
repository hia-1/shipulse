<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

const route = useRoute()
const appTitle = '时脉书社 · 管理端'

watch(
  () => route.meta.title,
  (title) => {
    document.title = title ? `${title} - ${appTitle}` : appTitle
  },
  { immediate: true },
)
</script>

<template>
  <el-config-provider :locale="zhCn">
    <router-view />
  </el-config-provider>
</template>