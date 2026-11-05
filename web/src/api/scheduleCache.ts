import type { QueryClient } from '@tanstack/react-query'
import type { IsoDate, Schedule } from './types'

const schedulesFilter = { queryKey: ['schedules'] }

let lastTempId = 0

export function snapshotSchedules(client: QueryClient) {
  return client.getQueriesData<Schedule[]>(schedulesFilter)
}

export function restoreSchedules(client: QueryClient, snapshot: ReturnType<typeof snapshotSchedules>) {
  snapshot.forEach(([key, data]) => client.setQueryData(key, data))
}

export function findCachedSchedule(client: QueryClient, id: number) {
  return snapshotSchedules(client)
    .flatMap(([, data]) => data ?? [])
    .find((schedule) => schedule.id === id)
}

export function putSchedule(client: QueryClient, schedule: Schedule, replaceId = schedule.id) {
  for (const [key, data] of snapshotSchedules(client)) {
    if (!data) continue
    const [, from, to] = key as [string, IsoDate, IsoDate]
    const rest = data.filter((item) => item.id !== replaceId)
    client.setQueryData(key, from <= schedule.date && schedule.date <= to ? [...rest, schedule] : rest)
  }
}

export function removeCachedSchedule(client: QueryClient, id: number) {
  client.setQueriesData<Schedule[]>(schedulesFilter, (data) => data?.filter((schedule) => schedule.id !== id))
}

export function nextTempId() {
  return --lastTempId
}
