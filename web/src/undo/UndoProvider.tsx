import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { useCreateSchedule, useDeleteSchedule, useReplaceEmployees, useUpdateSchedule } from '../api/mutations'
import { useEmployees } from '../api/queries'
import { mutationErrorMessage } from '../api/queryClient'
import { findCachedSchedule } from '../api/scheduleCache'
import { pushEntry, replaceScheduleId } from './undoStack'
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
  const [toast, setToast] = useState<Toast | null>(null)
  const createSchedule = useCreateSchedule()
  const updateSchedule = useUpdateSchedule()
  const deleteSchedule = useDeleteSchedule()
  const replaceEmployees = useReplaceEmployees()
  const employees = useEmployees()
  const queryClient = useQueryClient()
  const isInactive = (id: number) =>
    employees.data?.some((employee) => employee.id === id && employee.status === 'inactivo')

  const push = (entry: UndoEntry) => {
    setStack((current) => pushEntry(current, entry))
    setToast({ message: entry.label, kind: 'action' })
  }
  const showError = (message: string) => setToast({ message, kind: 'error' })
  const dismiss = useCallback(() => setToast(null), [])

  const runInverse = async (op: InverseOp) => {
    if (op.kind === 'delete') await deleteSchedule.mutateAsync(op.id)
    if (op.kind === 'patch') await updateSchedule.mutateAsync({ id: op.id, changes: op.changes })
    if (op.kind === 'put') {
      const assigned = findCachedSchedule(queryClient, op.id)?.employee_ids ?? []
      await replaceEmployees.mutateAsync({
        id: op.id,
        employee_ids: op.employee_ids.filter((id) => !isInactive(id) || assigned.includes(id)),
      })
    }
    if (op.kind === 'create') {
      const created = await createSchedule.mutateAsync({
        job: op.job,
        date: op.date,
        start_time: op.start_time,
        employee_ids: op.employee_ids.filter((id) => !isInactive(id)),
      })
      setStack((current) => replaceScheduleId(current, op.replacesId, created.id))
    }
  }

  const undo = async () => {
    const entry = stack.at(-1)
    if (!entry) return
    setStack((current) => current.slice(0, -1))
    dismiss()
    try {
      await Promise.all(entry.ops.map(runInverse))
    } catch (error) {
      setStack((current) => pushEntry(current, entry))
      showError(mutationErrorMessage(error))
    }
  }

  return (
    <UndoContext.Provider value={{ stack, toast, push, showError, dismiss, undo }}>{children}</UndoContext.Provider>
  )
}

export function useUndo() {
  return useContext(UndoContext)!
}
