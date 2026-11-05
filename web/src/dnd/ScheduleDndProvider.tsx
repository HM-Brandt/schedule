import { DragDropProvider } from '@dnd-kit/react'
import type { ReactNode } from 'react'
import { useCreateSchedule } from '../api/mutations'
import type { Schedule } from '../api/types'
import { defaultStartTime } from '../lib/startTime'
import { resolveDrop } from './dropResolution'
import type { DragData, DropData } from './dropResolution'

export function ScheduleDndProvider({ schedules, children }: { schedules: Schedule[]; children: ReactNode }) {
  const createSchedule = useCreateSchedule()

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
      }}
    >
      {children}
    </DragDropProvider>
  )
}
