import { http } from './index'

export interface GoalItem {
  id: number
  goalType: 'yearly' | 'monthly'
  period: string
  targetMinutes: number
  targetBooks: number
  actualMinutes: number
  actualBooks: number
  status: string
  minuteProgress: number
  bookProgress: number
  achieved: boolean
}

export interface StreakInfo {
  currentStreak: number
  longestStreak: number
}

export interface GoalProgressResult {
  goals: GoalItem[]
  streak: StreakInfo
}

export interface BadgeItem {
  id: number
  code: string
  name: string
  description: string
  iconUrl: string
  category: string
  ruleType: string
  ruleValue: number | null
  sort: number
  unlocked: boolean
  unlockedAt: string | null
  progress: number | null
}

export interface AwardResult {
  awarded: { badgeId: number; code: string; name: string }[]
}

export function getGoals() {
  return http.get<GoalItem[]>('/incentive/goals')
}

export function createGoal(data: {
  goalType: 'yearly' | 'monthly'
  period?: string
  targetMinutes?: number
  targetBooks?: number
}) {
  return http.post<GoalItem>('/incentive/goals', data)
}

export function updateGoal(id: number, data: { targetMinutes?: number; targetBooks?: number }) {
  return http.put<GoalItem>(`/incentive/goals/${id}`, data)
}

export function getGoalProgress() {
  return http.get<GoalProgressResult>('/incentive/goals/progress')
}

export function getStreak() {
  return http.get<StreakInfo>('/incentive/streak')
}

export function getAllBadges() {
  return http.get<BadgeItem[]>('/incentive/badges')
}

export function getMyBadges() {
  return http.get<BadgeItem[]>('/incentive/badges/mine')
}

export function checkBadges() {
  return http.post<AwardResult>('/incentive/badges/check')
}
