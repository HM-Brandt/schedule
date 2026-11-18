import { useQuery, useQueryClient } from '@tanstack/react-query'
import { sortJobs } from '../lib/jobs'
import { toSchedule, unknownJob } from '../lib/schedules'
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
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: queryKeys.schedules(from, to),
    queryFn: async () => {
      const [responses, jobs] = await Promise.all([
        api.getSchedules({ from, to }),
        queryClient.ensureQueryData({ queryKey: queryKeys.jobs, queryFn: () => api.getJobs() }),
      ])
      const jobsById = new Map(jobs.map((job) => [job.jobsId, job]))
      return responses.map((r) => toSchedule(r, jobsById.get(r.jobsId) ?? unknownJob(r.jobsId)))
    },
  })
}
