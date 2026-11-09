import { DragDropProvider } from '@dnd-kit/react'
import type { ReactNode } from 'react'
import { useCreateSchedule, useDeleteSchedule, useUpdateSchedule } from '../api/mutations'
import type { Schedule } from '../api/types'
import { defaultStartTime, startTimeForMove } from '../lib/startTime'
import { resolveDrop } from './dropResolution'
import type { DragData, DropData } from './dropResolution'

export function ScheduleDndProvider({ schedules, children }: { schedules: Schedule[]; children: ReactNode }) {
  const createSchedule = useCreateSchedule()
  const updateSchedule = useUpdateSchedule()
  const deleteSchedule = useDeleteSchedule()

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        const { source, target } = event.operation
        if (event.canceled || !source) return
        const action = resolveDrop(source.data as DragData, (target?.data as DropData | undefined) ?? null, {
          altKey: (event.nativeEvent as MouseEvent | undefined)?.altKey ?? false,
        })
        if (action.kind === 'create') {
          createSchedule.mutate({
            job: action.job,
            date: action.date,
            start_time: defaultStartTime(schedules, action.job.id, action.date),
          })
        }
        if (action.kind === 'move') {
          updateSchedule.mutate({
            id: action.schedule.id,
            changes: { date: action.date, start_time: startTimeForMove(schedules, action.schedule, action.date) },
          })
        }
        if (action.kind === 'duplicate') {
          createSchedule.mutate({
            job: action.schedule.job,
            date: action.date,
            start_time: defaultStartTime(schedules, action.schedule.job.id, action.date),
            employee_ids: action.schedule.employee_ids,
          })
        }
        if (action.kind === 'remove') deleteSchedule.mutate(action.schedule.id)
      }}
    >
      {children}
    </DragDropProvider>
  )
}
