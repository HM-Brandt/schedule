import type { AbsenceType, IsoDate, Job, StartTime, UpdateScheduleBody } from '../api/types'

export type InverseOp =
  | { kind: 'delete'; id: number }
  | { kind: 'patch'; id: number; changes: UpdateScheduleBody }
  | {
      kind: 'create'
      job: Job
      date: IsoDate
      startTime: StartTime
      employeesIds: number[]
      scheduleComment: string | null
      replacesId: number
    }
  | { kind: 'put'; id: number; employeesIds: number[] }
  | { kind: 'delete-absence'; id: number }
  | {
      kind: 'create-absence'
      employeesId: number
      date: IsoDate
      absenceType: AbsenceType
      absenceComment: string | null
      replacesId: number
    }

export type UndoEntry = { label: string; ops: InverseOp[] }

const MAX_ENTRIES = 20

export function pushEntry(stack: UndoEntry[], entry: UndoEntry): UndoEntry[] {
  return [...stack, entry].slice(-MAX_ENTRIES)
}

export function replaceScheduleId(stack: UndoEntry[], oldId: number, newId: number): UndoEntry[] {
  return stack.map((entry) => ({
    ...entry,
    ops: entry.ops.map((op) =>
      (op.kind === 'delete' || op.kind === 'patch' || op.kind === 'put') && op.id === oldId ? { ...op, id: newId } : op,
    ),
  }))
}

export function replaceAbsenceId(stack: UndoEntry[], oldId: number, newId: number): UndoEntry[] {
  return stack.map((entry) => ({
    ...entry,
    ops: entry.ops.map((op) => (op.kind === 'delete-absence' && op.id === oldId ? { ...op, id: newId } : op)),
  }))
}
