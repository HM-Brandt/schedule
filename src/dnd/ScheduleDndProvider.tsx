import { DragDropProvider, DragOverlay } from '@dnd-kit/react'
import type { ReactNode } from 'react'
import type { Schedule } from '../api/types'
import { useScheduleActions } from '../undo/useScheduleActions'
import { DragPreview } from './DragPreview'
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
          actions.setEmployees(action.schedule, [...action.schedule.employeesIds, action.employeeId])
        }
        if (action.kind === 'transfer' || action.kind === 'unassign') {
          const from = schedules.find((schedule) => schedule.jobSchedulesId === action.fromScheduleId)
          if (from && action.kind === 'unassign') {
            actions.setEmployees(from, from.employeesIds.filter((id) => id !== action.employeeId))
          }
          if (from && action.kind === 'transfer') actions.transferEmployee(action.employeeId, from, action.schedule)
        }
      }}
    >
      {children}
      <DragOverlay
        dropAnimation={null}
        disabled={(source) => {
          const data = source?.data as DragData | undefined
          return !(data?.kind === 'catalog-job' || (data?.kind === 'employee' && data.fromScheduleId === undefined))
        }}
      >
        {(source) => <DragPreview source={source} />}
      </DragOverlay>
    </DragDropProvider>
  )
}
