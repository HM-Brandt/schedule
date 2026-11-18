import type { IsoDate, Job, Schedule } from '../api/types'

export type DragData =
  | { kind: 'catalog-job'; job: Job }
  | { kind: 'schedule-card'; schedule: Schedule }
  | { kind: 'employee'; employeeId: number; fromScheduleId?: number }

export type DropData = { kind: 'day'; date: IsoDate } | { kind: 'schedule-card'; schedule: Schedule } | { kind: 'catalog' }

export type DropAction =
  | { kind: 'none' }
  | { kind: 'create'; job: Job; date: IsoDate }
  | { kind: 'move'; schedule: Schedule; date: IsoDate }
  | { kind: 'duplicate'; schedule: Schedule; date: IsoDate }
  | { kind: 'remove'; schedule: Schedule }
  | { kind: 'assign'; employeeId: number; schedule: Schedule }
  | { kind: 'transfer'; employeeId: number; fromScheduleId: number; schedule: Schedule }
  | { kind: 'unassign'; employeeId: number; fromScheduleId: number }

export const ACCEPTS: Record<DropData['kind'], DragData['kind'][]> = {
  day: ['catalog-job', 'schedule-card'],
  'schedule-card': ['employee'],
  catalog: ['schedule-card'],
}

const NONE: DropAction = { kind: 'none' }

export function resolveDrop(source: DragData, target: DropData | null, { altKey }: { altKey: boolean }): DropAction {
  if (source.kind === 'catalog-job' && target?.kind === 'day') return { kind: 'create', job: source.job, date: target.date }
  if (source.kind === 'schedule-card' && target?.kind === 'day') {
    if (altKey) return { kind: 'duplicate', schedule: source.schedule, date: target.date }
    return target.date === source.schedule.date ? NONE : { kind: 'move', schedule: source.schedule, date: target.date }
  }
  if (source.kind === 'schedule-card' && target?.kind === 'catalog') return { kind: 'remove', schedule: source.schedule }
  if (source.kind === 'employee' && target?.kind === 'schedule-card') {
    const { employeeId, fromScheduleId } = source
    const { schedule } = target
    if (fromScheduleId === undefined) {
      return schedule.employeesIds.includes(employeeId) ? NONE : { kind: 'assign', employeeId, schedule }
    }
    if (schedule.jobSchedulesId === fromScheduleId) return NONE
    if (schedule.employeesIds.includes(employeeId)) return { kind: 'unassign', employeeId, fromScheduleId }
    return { kind: 'transfer', employeeId, fromScheduleId, schedule }
  }
  if (source.kind === 'employee' && target === null && source.fromScheduleId !== undefined) {
    return { kind: 'unassign', employeeId: source.employeeId, fromScheduleId: source.fromScheduleId }
  }
  return NONE
}
