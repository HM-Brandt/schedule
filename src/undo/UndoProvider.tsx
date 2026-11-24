import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  useCreateAbsence,
  useCreateSchedule,
  useDeleteAbsence,
  useDeleteSchedule,
  useReplaceEmployees,
  useUpdateSchedule,
} from '../api/mutations'
import { useEmployees } from '../api/queries'
import { mutationErrorMessage } from '../api/queryClient'
import { findCachedSchedule } from '../api/scheduleCache'
import { pushEntry, replaceAbsenceId, replaceScheduleId } from './undoStack'
import type { InverseOp, UndoEntry } from './undoStack'

type Toast = { message: string; kind: 'action' | 'error' }

type UndoContextValue = {
  stack: UndoEntry[]
  toast: Toast | null
  push: (entry: UndoEntry) => void
  showError: (message: string) => void
  dismiss: () => void
  undo: () => void
}

const UndoContext = createContext<UndoContextValue | null>(null)

export function UndoProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<UndoEntry[]>([])
  const stackRef = useRef<UndoEntry[]>([])
  const queue = useRef(Promise.resolve())
  const [toast, setToast] = useState<Toast | null>(null)
  const createSchedule = useCreateSchedule()
  const updateSchedule = useUpdateSchedule()
  const deleteSchedule = useDeleteSchedule()
  const replaceEmployees = useReplaceEmployees()
  const createAbsence = useCreateAbsence()
  const deleteAbsence = useDeleteAbsence()
  const employees = useEmployees()
  const queryClient = useQueryClient()
  const isInactive = (id: number) =>
    employees.data?.some((employee) => employee.employeesId === id && employee.status === 'Terminated')

  const updateStack = (change: (current: UndoEntry[]) => UndoEntry[]) => {
    stackRef.current = change(stackRef.current)
    setStack(stackRef.current)
  }

  const push = (entry: UndoEntry) => {
    updateStack((current) => pushEntry(current, entry))
    setToast({ message: entry.label, kind: 'action' })
  }
  const showError = (message: string) => setToast({ message, kind: 'error' })
  const dismiss = useCallback(() => setToast(null), [])

  const runInverse = async (op: InverseOp) => {
    if (op.kind === 'delete') await deleteSchedule.mutateAsync(op.id)
    if (op.kind === 'patch') await updateSchedule.mutateAsync({ id: op.id, changes: op.changes })
    if (op.kind === 'put') {
      const assigned = findCachedSchedule(queryClient, op.id)?.employeesIds ?? []
      await replaceEmployees.mutateAsync({
        id: op.id,
        employeesIds: op.employeesIds.filter((id) => !isInactive(id) || assigned.includes(id)),
      })
    }
    if (op.kind === 'create') {
      const created = await createSchedule.mutateAsync({
        job: op.job,
        date: op.date,
        startTime: op.startTime,
        employeesIds: op.employeesIds.filter((id) => !isInactive(id)),
        scheduleComment: op.scheduleComment,
      })
      updateStack((current) => replaceScheduleId(current, op.replacesId, created.jobSchedulesId))
    }
    if (op.kind === 'delete-absence') await deleteAbsence.mutateAsync(op.id)
    if (op.kind === 'create-absence') {
      const created = await createAbsence.mutateAsync({
        employeesId: op.employeesId,
        date: op.date,
        absenceType: op.absenceType,
        absenceComment: op.absenceComment,
      })
      updateStack((current) => replaceAbsenceId(current, op.replacesId, created.absence.employeeAbsencesId))
    }
  }

  const undo = () => {
    if (stackRef.current.length) dismiss()
    queue.current = queue.current.then(async () => {
      const entry = stackRef.current.at(-1)
      if (!entry) return
      updateStack((current) => current.slice(0, -1))
      dismiss()
      try {
        for (const op of entry.ops) await runInverse(op)
      } catch (error) {
        updateStack((current) => pushEntry(current, entry))
        showError(mutationErrorMessage(error))
      }
    })
    return queue.current
  }

  return (
    <UndoContext.Provider value={{ stack, toast, push, showError, dismiss, undo }}>{children}</UndoContext.Provider>
  )
}

export function useUndo() {
  return useContext(UndoContext)!
}
