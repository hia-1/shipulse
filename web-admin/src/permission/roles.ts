/**
 * 角色与权限点定义
 * 与 db/init/02_seed_reference.sql 内置角色保持一致
 */
export interface Role {
  code: string
  name: string
  description: string
  /** 权限点：`*` 表示全权限；支持资源通配 `book:*` 或具体 `review:audit` */
  permissions: string[]
}

export interface PermissionNode {
  /** 权限点标识，如 `dashboard:view`、`book:*` */
  key: string
  /** 权限点名称 */
  name: string
}

export const ROLES: Record<string, Role> = {
  super_admin: {
    code: 'super_admin',
    name: '超级管理员',
    description: '全部权限 + 财务 + 权限分配',
    permissions: ['*'],
  },
  content_ops: {
    code: 'content_ops',
    name: '内容运营',
    description: '建书、审核、举报处理、运营位与活动管理',
    permissions: [
      'dashboard:view',
      'book:*',
      'category:*',
      'tag:*',
      'review:audit',
      'post:audit',
      'comment:audit',
      'report:*',
      'banner:*',
      'topic:*',
      'column:*',
      'event:*',
    ],
  },
  finance: {
    code: 'finance',
    name: '财务运营',
    description: '订单、流水、兑换码与会员管理',
    permissions: ['dashboard:view', 'order:*', 'payment:*', 'redeem:*', 'member:*'],
  },
  customer_service: {
    code: 'customer_service',
    name: '客服',
    description: '反馈处理、举报查看与用户查询',
    permissions: ['dashboard:view', 'feedback:*', 'report:read', 'report:handle', 'user:read'],
  },
}

export const ROLE_ORDER = ['super_admin', 'content_ops', 'finance', 'customer_service']

export function getRole(code: string): Role | undefined {
  return ROLES[code]
}

export function listRoles(): Role[] {
  return ROLE_ORDER.map((c) => ROLES[c]).filter(Boolean)
}