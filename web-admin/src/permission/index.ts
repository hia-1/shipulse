import { getRole } from './roles'

/** 判断某权限点是否匹配资源通配，如 `book:create` 匹配 `book:*`；`list` 匹配 `*` */
export function matchPermission(perm: string, required: string): boolean {
  if (perm === '*') return true
  if (perm === required) return true
  // 前缀通配：book:* 匹配 book:create
  if (perm.endsWith(':*')) {
    const resource = perm.slice(0, -1) // `book:`
    return required.startsWith(resource)
  }
  return false
}

/** 角色集合是否拥有某权限点 */
export function hasPermission(roleCodes: string[], required: string): boolean {
  return roleCodes.some((code) => {
    const role = getRole(code)
    return !!role && role.permissions.some((p) => matchPermission(p, required))
  })
}

/** 权限点列表过滤：保留无权限需求的项或角色拥有的项 */
export function canAccess(required: string | string[] | undefined, roleCodes: string[]): boolean {
  if (!required || required.length === 0) return true
  const list = Array.isArray(required) ? required : [required]
  // 满足任一权限点即可
  return list.some((r) => hasPermission(roleCodes, r))
}