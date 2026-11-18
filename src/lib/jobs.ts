import type { Job } from '../api/types'

export function sortJobs(jobs: Job[]): Job[] {
  return [...jobs].sort((a, b) => b.number.localeCompare(a.number, undefined, { numeric: true }))
}

export function filterJobs(jobs: Job[], search: string): Job[] {
  const term = search.trim().toLowerCase()
  return jobs.filter(
    (job) => job.number.toLowerCase().includes(term) || job.name.toLowerCase().includes(term),
  )
}
