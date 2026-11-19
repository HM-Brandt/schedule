import { useMutation } from '@tanstack/react-query'
import type { MutationFunctionContext, QueryKey } from '@tanstack/react-query'
import { toSchedule, unknownJob } from '../lib/schedules'
import { putAbsence, removeCachedAbsence } from './absenceCache'
import { api } from './client'
import {
  findCachedSchedule,
  nextTempId,
  putSchedule,
  removeCachedSchedule,
  snapshotSchedules,
} from './scheduleCache'
import type { CreateAbsenceBody, IsoDate, Job, StartTime, UpdateScheduleBody } from './types'

type Snapshot = { snapshot: [QueryKey, unknown][] }

async function startOptimistic(context: MutationFunctionContext, keys: QueryKey[]): Promise<Snapshot> {
  await Promise.all(keys.map((queryKey) => context.client.cancelQueries({ queryKey })))
  return { snapshot: keys.flatMap((queryKey) => context.client.getQueriesData({ queryKey })) }
}

function rollbackAndRefetch(keys: QueryKey[]) {
  return {
    onError: (_error: unknown, _variables: unknown, result: Snapshot | undefined, context: MutationFunctionContext) => {
      result?.snapshot.forEach(([key, data]) => context.client.setQueryData(key, data))
    },
    onSettled: (
      _data: unknown,
      _error: unknown,
      _variables: unknown,
      _result: unknown,
      context: MutationFunctionContext,
    ) => Promise.all(keys.map((queryKey) => context.client.invalidateQueries({ queryKey }))),
  }
}

export function useCreateSchedule() {
  return useMutation({
    mutationFn: ({
      job,
      ...body
    }: {
      job: Job
      date: IsoDate
      startTime: StartTime
      employeesIds?: number[]
      scheduleComment?: string | null
    }) => api.createSchedule({ jobsId: job.jobsId, ...body }).then((response) => toSchedule(response, job)),
    onMutate: async (variables, context) => {
      const result = await startOptimistic(context, [['schedules']])
      const tempId = nextTempId()
      putSchedule(context.client, {
        ...variables,
        jobSchedulesId: tempId,
        employeesIds: variables.employeesIds ?? [],
        scheduleComment: variables.scheduleComment ?? null,
      })
      return { ...result, tempId }
    },
    onSuccess: (schedule, _variables, result, context) => putSchedule(context.client, schedule, result.tempId),
    ...rollbackAndRefetch([['schedules']]),
  })
}

export function useUpdateSchedule() {
  return useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: UpdateScheduleBody }) => api.updateSchedule(id, changes),
    onMutate: async ({ id, changes }, context) => {
      const result = await startOptimistic(context, [['schedules']])
      const schedule = findCachedSchedule(context.client, id)
      if (schedule) putSchedule(context.client, { ...schedule, ...changes })
      return result
    },
    ...rollbackAndRefetch([['schedules']]),
  })
}

export function useDeleteSchedule() {
  return useMutation({
    mutationFn: (id: number) => api.deleteSchedule(id),
    onMutate: async (id, context) => {
      const result = await startOptimistic(context, [['schedules']])
      removeCachedSchedule(context.client, id)
      return result
    },
    ...rollbackAndRefetch([['schedules']]),
  })
}

export function useReplaceEmployees() {
  return useMutation({
    mutationFn: ({ id, employeesIds }: { id: number; employeesIds: number[] }) =>
      api.replaceScheduleEmployees(id, { employeesIds }),
    onMutate: async ({ id, employeesIds }, context) => {
      const result = await startOptimistic(context, [['schedules']])
      const schedule = findCachedSchedule(context.client, id)
      if (schedule) putSchedule(context.client, { ...schedule, employeesIds })
      return result
    },
    ...rollbackAndRefetch([['schedules']]),
  })
}

export function useCreateAbsence() {
  return useMutation({
    mutationFn: (body: CreateAbsenceBody) => api.createAbsence(body),
    onMutate: async (body, context) => {
      const result = await startOptimistic(context, [['absences'], ['schedules']])
      const tempId = nextTempId()
      putAbsence(context.client, { ...body, employeeAbsencesId: tempId, absenceComment: body.absenceComment ?? null })
      for (const [, data] of snapshotSchedules(context.client)) {
        for (const schedule of data ?? []) {
          if (schedule.date === body.date && schedule.employeesIds.includes(body.employeesId)) {
            putSchedule(context.client, {
              ...schedule,
              employeesIds: schedule.employeesIds.filter((id) => id !== body.employeesId),
            })
          }
        }
      }
      return { ...result, tempId }
    },
    onSuccess: ({ absence, updatedSchedules }, _body, result, context) => {
      putAbsence(context.client, absence, result.tempId)
      for (const r of updatedSchedules) {
        putSchedule(
          context.client,
          toSchedule(r, findCachedSchedule(context.client, r.jobSchedulesId)?.job ?? unknownJob(r.jobsId)),
        )
      }
    },
    ...rollbackAndRefetch([['absences'], ['schedules']]),
  })
}

export function useDeleteAbsence() {
  return useMutation({
    mutationFn: (id: number) => api.deleteAbsence(id),
    onMutate: async (id, context) => {
      const result = await startOptimistic(context, [['absences']])
      removeCachedAbsence(context.client, id)
      return result
    },
    ...rollbackAndRefetch([['absences']]),
  })
}
