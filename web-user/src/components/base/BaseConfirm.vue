<script setup lang="ts">
import BaseModal from './BaseModal.vue'
import BaseButton from './BaseButton.vue'
import { useConfirm } from '@/composables/useConfirm'

const { state, accept, cancel } = useConfirm()
</script>

<template>
  <BaseModal :open="state.open" :title="state.title" @close="cancel">
    <p class="whitespace-pre-line text-body-md text-ink-secondary">{{ state.message }}</p>
    <template #footer>
      <div class="flex gap-sm">
        <BaseButton variant="ghost" class="flex-1" @click="cancel">{{ state.cancelText }}</BaseButton>
        <BaseButton class="flex-1" :class="{ 'text-danger': state.danger }" @click="accept">
          {{ state.confirmText }}
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>