import Store from 'electron-store'
import type { DailyPlan } from '../../shared/types/plan'

// Each plan is a top-level `plan:YYYY-MM-DD` key, kept apart from schedules, todos and diary.
export const dailyPlanStore = new Store<Record<string, DailyPlan>>({
  name: 'plans'
})
