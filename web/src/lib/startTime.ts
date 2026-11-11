import type { IsoDate, Schedule, StartTime } from '../api/types'

export function defaultStartTime(schedules: Schedule[], jobId: number, date: IsoDate, excludeId?: number): StartTime {
  const hours = schedules
    .filter((schedule) => schedule.job.jobsId === jobId && schedule.date === date && schedule.jobSchedulesId !== excludeId)
    .map((schedule) => Number(schedule.startTime.slice(0, 2)))
  if (hours.length === 0) return '07:00'
  return `${String(Math.min(23, Math.max(...hours) + 1)).padStart(2, '0')}:00`
}

export function startTimeForMove(schedules: Schedule[], schedule: Schedule, targetDate: IsoDate): StartTime {
  const repeated = schedules.some(
    (other) => other.jobSchedulesId !== schedule.jobSchedulesId && other.job.jobsId === schedule.job.jobsId && other.date === targetDate,
  )
  return repeated ? defaultStartTime(schedules, schedule.job.jobsId, targetDate, schedule.jobSchedulesId) : schedule.startTime
}
