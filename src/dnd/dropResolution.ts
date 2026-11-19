import type { Absence, IsoDate, Job, Schedule } from '../api/types'
import { absentEmployees } from '../lib/selectors'

export type DragData =
  | { kind: 'catalog-job'; job: Job }
  | { kind: 'schedule-card'; schedule: Schedule }
  | { kind: 'employee'; employeeId: number; fromScheduleId?: number }
  | { kind: 'absence'; employeeAbsencesId: number; employeeId: number; date: IsoDate }

export type DropData =
  | { kind: 'day'; date: IsoDate }
  | { kind: 'schedule-card'; schedule: Schedule }
  | { kind: 'catalog' }
  | { kind: 'absences'; date: IsoDate }

export type DropAction =
  | { kind: 'none' }
  | { kind: 'create'; job: Job; date: IsoDate }
  | { kind: 'move'; schedule: Schedule; date: IsoDate }
  | { kind: 'duplicate'; schedule: Schedule; date: IsoDate }
  | { kind: 'remove'; schedule: Schedule }
  | { kind: 'assign'; employeeId: number; schedule: Schedule }
  | { kind: 'transfer'; employeeId: number; fromScheduleId: number; schedule: Schedule }
  | { kind: 'unassign'; employeeId: number; fromScheduleId: number }
  | { kind: 'mark-absent'; employeeId: number; date: IsoDate }
  | { kind: 'remove-absence'; employeeAbsencesId: number }
  | { kind: 'blocked-move'; schedule: Schedule; date: IsoDate; employeeIds: number[] }
  | { kind: 'blocked-assign'; employeeId: number; date: IsoDate }

export const ACCEPTS: Record<DropData['kind'], DragData['kind'][]> = {
  day: ['catalog-job', 'schedule-card'],
  'schedule-card': ['employee'],
  catalog: ['schedule-card'],
  absences: ['employee', 'absence'],
}

const NONE: DropAction = { kind: 'none' }

export function resolveDrop(
  source: DragData,
  target: DropData | null,
  { altKey, absences }: { altKey: boolean; absences: Map<number, Map<IsoDate, Absence>> },
): DropAction {
  if (source.kind === 'absence') {
    return target === null ? { kind: 'remove-absence', employeeAbsencesId: source.employeeAbsencesId } : NONE
  }
  if (source.kind === 'catalog-job' && target?.kind === 'day') return { kind: 'create', job: source.job, date: target.date }
  if (source.kind === 'schedule-card' && target?.kind === 'day') {
    if (altKey) return { kind: 'duplicate', schedule: source.schedule, date: target.date }
    if (target.date === source.schedule.date) return NONE
    const employeeIds = absentEmployees(source.schedule.employeesIds, target.date, absences)
    if (employeeIds.length > 0) return { kind: 'blocked-move', schedule: source.schedule, date: target.date, employeeIds }
    return { kind: 'move', schedule: source.schedule, date: target.date }
  }
  if (source.kind === 'schedule-card' && target?.kind === 'catalog') return { kind: 'remove', schedule: source.schedule }
  if (source.kind === 'employee' && target?.kind === 'absences') {
    if (absences.get(source.employeeId)?.has(target.date)) return NONE
    return { kind: 'mark-absent', employeeId: source.employeeId, date: target.date }
  }
  if (source.kind === 'employee' && target?.kind === 'schedule-card') {
    const { employeeId, fromScheduleId } = source
    const { schedule } = target
    if (absences.get(employeeId)?.has(schedule.date)) return { kind: 'blocked-assign', employeeId, date: schedule.date }
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
