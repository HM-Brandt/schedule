import { DragDropProvider } from '@dnd-kit/react'
import type { ReactNode } from 'react'
import type { Schedule } from '../api/types'
import { useScheduleActions } from '../undo/useScheduleActions'
import { resolveDrop } from './dropResolution'
import type { DragData, DropData } from './dropResolution'

export function ScheduleDndProvider({ schedules, children }: { schedules: Schedule[]; children: ReactNode }) {
  const actions = useScheduleActions(schedules)

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        const { source, target } = event.operation
        if (event.canceled || !source) return
        const action = resolveDrop(source.data as DragData, (target?.data as DropData | undefined) ?? null, {
          altKey: (event.nativeEvent as MouseEvent | undefined)?.altKey ?? false,
        })
        if (action.kind === 'create') actions.create(action.job, action.date)
        if (action.kind === 'move') actions.move(action.schedule, action.date)
        if (action.kind === 'duplicate') actions.duplicate(action.schedule, action.date)
        if (action.kind === 'remove') actions.remove(action.schedule)
        if (action.kind === 'assign') {
          actions.setEmployees(action.schedule, [...action.schedule.employee_ids, action.employeeId])
        }
        if (action.kind === 'transfer' || action.kind === 'unassign') {
          const from = schedules.find((schedule) => schedule.id === action.fromScheduleId)
          if (from && action.kind === 'unassign') {
            actions.setEmployees(from, from.employee_ids.filter((id) => id !== action.employeeId))
          }
          if (from && action.kind === 'transfer') actions.transferEmployee(action.employeeId, from, action.schedule)
        }
      }}
    >
      {children}
    </DragDropProvider>
  )
}
