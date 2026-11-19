import { DragDropProvider, DragOverlay } from '@dnd-kit/react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AbsenceDialog } from '../absences/AbsenceDialog'
import { useEmployees } from '../api/queries'
import type { Absence, IsoDate, Schedule } from '../api/types'
import { absenceLookup } from '../lib/selectors'
import { useScheduleActions } from '../undo/useScheduleActions'
import { DragPreview } from './DragPreview'
import { resolveDrop } from './dropResolution'
import type { DragData, DropData } from './dropResolution'

export function ScheduleDndProvider({
  schedules,
  absences,
  children,
}: {
  schedules: Schedule[]
  absences: Absence[]
  children: ReactNode
}) {
  const actions = useScheduleActions(schedules)
  const employees = useEmployees()
  const lookup = useMemo(() => absenceLookup(absences), [absences])
  const [pending, setPending] = useState<{ employeeId: number; date: IsoDate } | null>(null)
  const pendingEmployee = employees.data?.find((employee) => employee.employeesId === pending?.employeeId)

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        const { source, target } = event.operation
        if (event.canceled || !source) return
        const action = resolveDrop(source.data as DragData, (target?.data as DropData | undefined) ?? null, {
          altKey: (event.nativeEvent as MouseEvent | undefined)?.altKey ?? false,
          absences: lookup,
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
        if (action.kind === 'mark-absent') setPending({ employeeId: action.employeeId, date: action.date })
        if (action.kind === 'remove-absence') {
          const absence = absences.find((item) => item.employeeAbsencesId === action.employeeAbsencesId)
          if (absence) actions.removeAbsence(absence)
        }
        if (action.kind === 'blocked-move') actions.blockMove(action.employeeIds, action.date)
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
      {pending && pendingEmployee && (
        <AbsenceDialog
          employee={pendingEmployee}
          date={pending.date}
          onSave={({ absenceType, absenceComment }) => {
            actions.markAbsent(pending.employeeId, pending.date, absenceType, absenceComment)
            setPending(null)
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </DragDropProvider>
  )
}
