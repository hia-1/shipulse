import { http } from './index'

export interface Plan {
  id: number
  code: string
  name: string
  description: string
  priceFen: number
  originalPriceFen: number
  durationDays: number
  benefits: string[]
}

export interface MyStatus {
  isMember: boolean
  memberExpireAt: string | null
  plans: Plan[]
  subscription: {
    status: string
    planName: string
    startTime: string
    expireTime: string
    autoRenew: boolean
    channel: string
  } | null
}

export interface OrderResult {
  orderNo: string
  planId: number
  title: string
  amountFen: number
  autoRenew: boolean
  status: string
}

/** 套餐列表 */
export function listPlans() {
  return http.get<Plan[]>('/membership/plans')
}

/** 创建订单 */
export function createOrder(data: { planId: number; autoRenew?: boolean }) {
  return http.post<OrderResult>('/membership/orders', data)
}

/** 沙箱模拟支付回调 */
export function sandboxPay(orderNo: string) {
  return http.post<{
    paid: boolean
    orderNo: string
    amountFen: number
    memberExpireAt: string | null
    isMember: boolean
  }>('/membership/pay/sandbox', { orderNo })
}

/** 我的会员状态 */
export function getMyStatus() {
  return http.get<MyStatus>('/membership/my')
}

/** 新用户试用 */
export function trial() {
  return http.post<{ ok: boolean; expireTime: string; planName: string }>(
    '/membership/trial',
  )
}

/** 兑换码核销 */
export function redeem(code: string) {
  return http.post<{ ok: boolean; expireTime: string; planName: string }>(
    '/membership/redeem',
    { code },
  )
}