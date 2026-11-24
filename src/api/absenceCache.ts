import type { QueryClient } from '@tanstack/react-query'
import type { Absence, IsoDate } from './types'

const absencesFilter = { queryKey: ['absences'] }

export function putAbsence(client: QueryClient, absence: Absence, replaceId = absence.employeeAbsencesId) {
  for (const [key, data] of client.getQueriesData<Absence[]>(absencesFilter)) {
    if (!data) continue
    const [, from, to] = key as [string, IsoDate, IsoDate]
    const rest = data.filter((item) => item.employeeAbsencesId !== replaceId)
    client.setQueryData(key, from <= absence.date && absence.date <= to ? [...rest, absence] : rest)
  }
}

export function removeCachedAbsence(client: QueryClient, id: number) {
  client.setQueriesData<Absence[]>(absencesFilter, (data) => data?.filter((absence) => absence.employeeAbsencesId !== id))
}
