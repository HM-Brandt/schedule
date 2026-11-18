import { useMutation } from '@tanstack/react-query'
import type { MutationFunctionContext } from '@tanstack/react-query'
import { toSchedule } from '../lib/schedules'
import { api } from './client'
import {
  findCachedSchedule,
  nextTempId,
  putSchedule,
  removeCachedSchedule,
  restoreSchedules,
  snapshotSchedules,
} from './scheduleCache'
import type { IsoDate, Job, StartTime, UpdateScheduleBody } from './types'

type Snapshot = { snapshot: ReturnType<typeof snapshotSchedules> }

async function startOptimistic(context: MutationFunctionContext): Promise<Snapshot> {
  await context.client.cancelQueries({ queryKey: ['schedules'] })
  return { snapshot: snapshotSchedules(context.client) }
}

const rollbackAndRefetch = {
  onError: (_error: unknown, _variables: unknown, result: Snapshot | undefined, context: MutationFunctionContext) => {
    if (result) restoreSchedules(context.client, result.snapshot)
  },
  onSettled: (
    _data: unknown,
    _error: unknown,
    _variables: unknown,
    _result: unknown,
    context: MutationFunctionContext,
  ) => context.client.invalidateQueries({ queryKey: ['schedules'] }),
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
      const result = await startOptimistic(context)
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
    ...rollbackAndRefetch,
  })
}

export function useUpdateSchedule() {
  return useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: UpdateScheduleBody }) => api.updateSchedule(id, changes),
    onMutate: async ({ id, changes }, context) => {
      const result = await startOptimistic(context)
      const schedule = findCachedSchedule(context.client, id)
      if (schedule) putSchedule(context.client, { ...schedule, ...changes })
      return result
    },
    ...rollbackAndRefetch,
  })
}

export function useDeleteSchedule() {
  return useMutation({
    mutationFn: (id: number) => api.deleteSchedule(id),
    onMutate: async (id, context) => {
      const result = await startOptimistic(context)
      removeCachedSchedule(context.client, id)
      return result
    },
    ...rollbackAndRefetch,
  })
}

export function useReplaceEmployees() {
  return useMutation({
    mutationFn: ({ id, employeesIds }: { id: number; employeesIds: number[] }) =>
      api.replaceScheduleEmployees(id, { employeesIds }),
    onMutate: async ({ id, employeesIds }, context) => {
      const result = await startOptimistic(context)
      const schedule = findCachedSchedule(context.client, id)
      if (schedule) putSchedule(context.client, { ...schedule, employeesIds })
      return result
    },
    ...rollbackAndRefetch,
  })
}
