import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from './client'
import type { IsoDate } from './types'

export const queryKeys = {
  employees: ['employees'] as const,
  jobs: (search: string) => ['jobs', search] as const,
  schedules: (from: IsoDate, to: IsoDate) => ['schedules', from, to] as const,
}

export function  useEmployees() {
  return useQuery({ queryKey: queryKeys.employees, queryFn: () => api.getEmployees() })
}

export function useJobs(search: string) {
  const term = search.trim()
  return useQuery({
    queryKey: queryKeys.jobs(term),
    queryFn: () => api.getJobs(term ? { search: term } : undefined),
    placeholderData: keepPreviousData,
  })
}

export function useWeekSchedules(from: IsoDate, to: IsoDate) {
  return useQuery({
    queryKey: queryKeys.schedules(from, to),
    queryFn: () => api.getSchedules({ from, to }),
  })
}
