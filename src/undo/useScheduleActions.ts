import { format } from 'date-fns'
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
import type { Absence, AbsenceType, IsoDate, Job, Schedule, StartTime } from '../api/types'
import { parseIsoDate } from '../lib/dates'
import { fullName } from '../lib/employees'
import { absenceLookup, absentEmployees } from '../lib/selectors'
import { defaultStartTime, startTimeForMove } from '../lib/startTime'
import { useUndo } from './UndoProvider'
import type { InverseOp } from './undoStack'

export function useScheduleActions(schedules: Schedule[], absences: Absence[] = []) {
  const { push, showError } = useUndo()
  const createSchedule = useCreateSchedule()
  const updateSchedule = useUpdateSchedule()
  const deleteSchedule = useDeleteSchedule()
  const replaceEmployees = useReplaceEmployees()
  const createAbsence = useCreateAbsence()
  const deleteAbsence = useDeleteAbsence()
  const employees = useEmployees()

  const run = (label: string, action: () => Promise<InverseOp[]>) =>
    action().then(
      (ops) => push({ label, ops }),
      (error) => showError(mutationErrorMessage(error)),
    )
  const restoreTime = (schedule: Schedule): InverseOp => ({
    kind: 'patch',
    id: schedule.jobSchedulesId,
    changes: { date: schedule.date, startTime: schedule.startTime },
  })
  const restoreEmployees = (schedule: Schedule): InverseOp => ({
    kind: 'put',
    id: schedule.jobSchedulesId,
    employeesIds: schedule.employeesIds,
  })

  return {
    create: (job: Job, date: IsoDate) =>
      run('Job scheduled', async () => {
        const created = await createSchedule.mutateAsync({ job, date, startTime: defaultStartTime(schedules, job.jobsId, date) })
        return [{ kind: 'delete', id: created.jobSchedulesId }]
      }),
    move: (schedule: Schedule, date: IsoDate) =>
      run('Job moved', async () => {
        await updateSchedule.mutateAsync({
          id: schedule.jobSchedulesId,
          changes: { date, startTime: startTimeForMove(schedules, schedule, date) },
        })
        return [restoreTime(schedule)]
      }),
    setStartTime: (schedule: Schedule, startTime: StartTime) =>
      run('Start time changed', async () => {
        await updateSchedule.mutateAsync({ id: schedule.jobSchedulesId, changes: { startTime } })
        return [restoreTime(schedule)]
      }),
    setComment: (schedule: Schedule, text: string) => {
      const scheduleComment = text.trim() ? text : null
      if (scheduleComment === schedule.scheduleComment) return
      return run('Comment updated', async () => {
        await updateSchedule.mutateAsync({ id: schedule.jobSchedulesId, changes: { scheduleComment } })
        return [{ kind: 'patch', id: schedule.jobSchedulesId, changes: { scheduleComment: schedule.scheduleComment } }]
      })
    },
    duplicate: (schedule: Schedule, date: IsoDate) =>
      run('Job duplicated', async () => {
        const absent = absentEmployees(schedule.employeesIds, date, absenceLookup(absences))
        const created = await createSchedule.mutateAsync({
          job: schedule.job,
          date,
          startTime: defaultStartTime(schedules, schedule.job.jobsId, date),
          employeesIds: schedule.employeesIds.filter(
            (id) =>
              !absent.includes(id) &&
              !employees.data?.some((employee) => employee.employeesId === id && employee.status === 'Terminated'),
          ),
        })
        return [{ kind: 'delete', id: created.jobSchedulesId }]
      }),
    remove: (schedule: Schedule) =>
      run('Job removed', async () => {
        await deleteSchedule.mutateAsync(schedule.jobSchedulesId)
        return [
          {
            kind: 'create',
            job: schedule.job,
            date: schedule.date,
            startTime: schedule.startTime,
            employeesIds: schedule.employeesIds,
            scheduleComment: schedule.scheduleComment,
            replacesId: schedule.jobSchedulesId,
          },
        ]
      }),
    setEmployees: (schedule: Schedule, employeesIds: number[]) =>
      run('Employees updated', async () => {
        await replaceEmployees.mutateAsync({ id: schedule.jobSchedulesId, employeesIds })
        return [restoreEmployees(schedule)]
      }),
    transferEmployee: (employeeId: number, from: Schedule, to: Schedule) =>
      run('Employee moved', async () => {
        await Promise.all([
          replaceEmployees.mutateAsync({ id: from.jobSchedulesId, employeesIds: from.employeesIds.filter((id) => id !== employeeId) }),
          replaceEmployees.mutateAsync({ id: to.jobSchedulesId, employeesIds: [...to.employeesIds, employeeId] }),
        ])
        return [restoreEmployees(from), restoreEmployees(to)]
      }),
    markAbsent: (employeeId: number, date: IsoDate, absenceType: AbsenceType, absenceComment: string | null) =>
      run('Absence marked', async () => {
        const response = await createAbsence.mutateAsync({ employeesId: employeeId, date, absenceType, absenceComment })
        return [
          { kind: 'delete-absence', id: response.absence.employeeAbsencesId },
          ...response.updatedSchedules.flatMap((r) =>
            schedules.filter((schedule) => schedule.jobSchedulesId === r.jobSchedulesId).map(restoreEmployees),
          ),
        ]
      }),
    removeAbsence: (absence: Absence) =>
      run('Absence removed', async () => {
        await deleteAbsence.mutateAsync(absence.employeeAbsencesId)
        return [
          {
            kind: 'create-absence',
            employeesId: absence.employeesId,
            date: absence.date,
            absenceType: absence.absenceType,
            absenceComment: absence.absenceComment,
            replacesId: absence.employeeAbsencesId,
          },
        ]
      }),
    blockMove: (employeeIds: number[], date: IsoDate) =>
      showError(
        `Can't move the job. Absent on ${format(parseIsoDate(date), 'EEE, MMM d')}: ${employeeIds
          .flatMap((id) => employees.data?.filter((employee) => employee.employeesId === id) ?? [])
          .map(fullName)
          .join(', ')}.`,
      ),
  }
}
