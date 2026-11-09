import type { IsoDate, Job, StartTime, UpdateScheduleBody } from '../api/types'

export type InverseOp =
  | { kind: 'delete'; id: number }
  | { kind: 'patch'; id: number; changes: UpdateScheduleBody }
  | { kind: 'create'; job: Job; date: IsoDate; start_time: StartTime; employee_ids: number[]; replacesId: number }
  | { kind: 'put'; id: number; employee_ids: number[] }

export type UndoEntry = { label: string; ops: InverseOp[] }

const MAX_ENTRIES = 20

export function pushEntry(stack: UndoEntry[], entry: UndoEntry): UndoEntry[] {
  return [...stack, entry].slice(-MAX_ENTRIES)
}

export function replaceScheduleId(stack: UndoEntry[], oldId: number, newId: number): UndoEntry[] {
  return stack.map((entry) => ({
    ...entry,
    ops: entry.ops.map((op) => (op.kind !== 'create' && op.id === oldId ? { ...op, id: newId } : op)),
  }))
}
