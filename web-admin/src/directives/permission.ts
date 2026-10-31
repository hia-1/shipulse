import type { Directive, DirectiveBinding } from 'vue'
import { useAdminStore } from '@/stores/admin'

/**
 * v-permission="'book:create'" 或 v-permission="['book:create','category:*']"
 * 无权限时移除元素
 */
export const permission: Directive<HTMLElement, string | string[] | undefined> = {
  mounted(el: HTMLElement, binding: DirectiveBinding<string | string[] | undefined>) {
    const adminStore = useAdminStore()
    const required = binding.value
    if (!required || required.length === 0) return
    const list = Array.isArray(required) ? required : [required]
    const allowed = list.some((r) => adminStore.hasPermission(r))
    if (!allowed) {
      el.parentNode?.removeChild(el)
    }
  },
}

export default permission