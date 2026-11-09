import { useCreateSchedule, useDeleteSchedule, useReplaceEmployees, useUpdateSchedule } from '../api/mutations'
import { useEmployees } from '../api/queries'
import { mutationErrorMessage } from '../api/queryClient'
import type { IsoDate, Job, Schedule, StartTime } from '../api/types'
import { defaultStartTime, startTimeForMove } from '../lib/startTime'
import { useUndo } from './UndoProvider'
import type { InverseOp } from './undoStack'

export function useScheduleActions(schedules: Schedule[]) {
  const { push, showError } = useUndo()
  const createSchedule = useCreateSchedule()
  const updateSchedule = useUpdateSchedule()
  const deleteSchedule = useDeleteSchedule()
  const replaceEmployees = useReplaceEmployees()
  const employees = useEmployees()

  const run = (label: string, action: () => Promise<InverseOp[]>) =>
    action().then(
      (ops) => push({ label, ops }),
      (error) => showError(mutationErrorMessage(error)),
    )
  const restoreTime = (schedule: Schedule): InverseOp => ({
    kind: 'patch',
    id: schedule.id,
    changes: { date: schedule.date, start_time: schedule.start_time },
  })
  const restoreEmployees = (schedule: Schedule): InverseOp => ({
    kind: 'put',
    id: schedule.id,
    employee_ids: schedule.employee_ids,
  })

  return {
    create: (job: Job, date: IsoDate) =>
      run('Job scheduled', async () => {
        const created = await createSchedule.mutateAsync({ job, date, start_time: defaultStartTime(schedules, job.id, date) })
        return [{ kind: 'delete', id: created.id }]
      }),
    move: (schedule: Schedule, date: IsoDate) =>
      run('Job moved', async () => {
        await updateSchedule.mutateAsync({
          id: schedule.id,
          changes: { date, start_time: startTimeForMove(schedules, schedule, date) },
        })
        return [restoreTime(schedule)]
      }),
    setStartTime: (schedule: Schedule, start_time: StartTime) =>
      run('Start time changed', async () => {
        await updateSchedule.mutateAsync({ id: schedule.id, changes: { start_time } })
        return [restoreTime(schedule)]
      }),
    duplicate: (schedule: Schedule, date: IsoDate) =>
      run('Job duplicated', async () => {
        const created = await createSchedule.mutateAsync({
          job: schedule.job,
          date,
          start_time: defaultStartTime(schedules, schedule.job.id, date),
          employee_ids: schedule.employee_ids.filter(
            (id) => !employees.data?.some((employee) => employee.id === id && employee.status === 'inactivo'),
          ),
        })
        return [{ kind: 'delete', id: created.id }]
      }),
    remove: (schedule: Schedule) =>
      run('Job removed', async () => {
        await deleteSchedule.mutateAsync(schedule.id)
        return [
          {
            kind: 'create',
            job: schedule.job,
            date: schedule.date,
            start_time: schedule.start_time,
            employee_ids: schedule.employee_ids,
            replacesId: schedule.id,
          },
        ]
      }),
    setEmployees: (schedule: Schedule, employee_ids: number[]) =>
      run('Employees updated', async () => {
        await replaceEmployees.mutateAsync({ id: schedule.id, employee_ids })
        return [restoreEmployees(schedule)]
      }),
    transferEmployee: (employeeId: number, from: Schedule, to: Schedule) =>
      run('Employee moved', async () => {
        await Promise.all([
          replaceEmployees.mutateAsync({ id: from.id, employee_ids: from.employee_ids.filter((id) => id !== employeeId) }),
          replaceEmployees.mutateAsync({ id: to.id, employee_ids: [...to.employee_ids, employeeId] }),
        ])
        return [restoreEmployees(from), restoreEmployees(to)]
      }),
  }
}
