import type { IsoDate, Schedule } from '../api/types'

export function compareSchedules(a: Schedule, b: Schedule): number {
  if (a.start_time !== b.start_time) return a.start_time < b.start_time ? -1 : 1
  if ((a.id < 0) !== (b.id < 0)) return a.id < 0 ? 1 : -1
  return Math.abs(a.id) - Math.abs(b.id)
}

export function schedulesByDay(schedules: Schedule[], days: IsoDate[]): Record<IsoDate, Schedule[]> {
  return Object.fromEntries(
    days.map((day) => [day, schedules.filter((schedule) => schedule.date === day).sort(compareSchedules)]),
  )
}

export function jobWeekCounts(schedules: Schedule[]) {
  const counts = new Map<number, number>()
  for (const schedule of schedules) counts.set(schedule.job.id, (counts.get(schedule.job.id) ?? 0) + 1)
  return counts
}

export function employeeDayCounts(schedules: Schedule[]) {
  const counts = new Map<number, Map<IsoDate, number>>()
  for (const schedule of schedules) {
    for (const employeeId of schedule.employee_ids) {
      const days = counts.get(employeeId) ?? new Map<IsoDate, number>()
      days.set(schedule.date, (days.get(schedule.date) ?? 0) + 1)
      counts.set(employeeId, days)
    }
  }
  return counts
}
