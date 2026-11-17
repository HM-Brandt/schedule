import { useQuery } from '@tanstack/react-query'
import { sortJobs } from '../lib/jobs'
import { useAuthStore } from '../stores/authStore'
import { api } from './client'
import type { IsoDate } from './types'

export const queryKeys = {
  me: ['me'] as const,
  employees: ['employees'] as const,
  jobs: ['jobs'] as const,
  schedules: (from: IsoDate, to: IsoDate) => ['schedules', from, to] as const,
}

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => {
      const user = await api.getMe()
      useAuthStore.getState().setUser(user)
      return user
    },
  })
}

export function  useEmployees() {
  return useQuery({ queryKey: queryKeys.employees, queryFn: () => api.getEmployees() })
}

export function useJobs() {
  return useQuery({ queryKey: queryKeys.jobs, queryFn: () => api.getJobs(), select: sortJobs })
}

export function useWeekSchedules(from: IsoDate, to: IsoDate) {
  return useQuery({
    queryKey: queryKeys.schedules(from, to),
    queryFn: () => api.getSchedules({ from, to }),
  })
}
