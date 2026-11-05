import type { IsoDate, Schedule, StartTime } from '../api/types'

export function defaultStartTime(schedules: Schedule[], jobId: number, date: IsoDate, excludeId?: number): StartTime {
  const hours = schedules
    .filter((schedule) => schedule.job.id === jobId && schedule.date === date && schedule.id !== excludeId)
    .map((schedule) => Number(schedule.start_time.slice(0, 2)))
  if (hours.length === 0) return '07:00'
  return `${String(Math.min(23, Math.max(...hours) + 1)).padStart(2, '0')}:00`
}

export function startTimeForMove(schedules: Schedule[], schedule: Schedule, targetDate: IsoDate): StartTime {
  const repeated = schedules.some(
    (other) => other.id !== schedule.id && other.job.id === schedule.job.id && other.date === targetDate,
  )
  return repeated ? defaultStartTime(schedules, schedule.job.id, targetDate, schedule.id) : schedule.start_time
}
