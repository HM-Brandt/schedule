// Tests de las utilidades de caché de ausencias (tarea 3.2 de `employee-absences`).
//
// Las semanas se guardan en la caché con la clave `['absences', from, to]`
// (decisión 4 de `design.md`).
import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it } from 'vitest'
import { putAbsence, removeCachedAbsence } from './absenceCache'
import { queryKeys } from './queries'
import type { Absence } from './types'

const SEMANA_1 = queryKeys.absences('2026-11-01', '2026-11-07')
const SEMANA_2 = queryKeys.absences('2026-11-08', '2026-11-14')

const AUSENCIA_1: Absence = { employeeAbsencesId: 1, employeesId: 7, date: '2026-11-04', absenceType: 'Vacation', absenceComment: 'Viaje familiar' }
const AUSENCIA_2: Absence = { employeeAbsencesId: 2, employeesId: 3, date: '2026-11-10', absenceType: 'Sick', absenceComment: null }

let client: QueryClient

beforeEach(() => {
  client = new QueryClient()
  client.setQueryData(SEMANA_1, [AUSENCIA_1])
  client.setQueryData(SEMANA_2, [AUSENCIA_2])
})

const semana = (clave: readonly unknown[]) => client.getQueryData<Absence[]>(clave)

describe('putAbsence', () => {
  it('añade la ausencia solo a la semana que contiene su fecha', () => {
    const nueva: Absence = { ...AUSENCIA_1, employeeAbsencesId: 10, employeesId: 4, date: '2026-11-05' }

    putAbsence(client, nueva)

    expect(semana(SEMANA_1)).toEqual([AUSENCIA_1, nueva])
    expect(semana(SEMANA_2)).toEqual([AUSENCIA_2])
  })

  it('incluye los extremos del rango (domingo y sábado)', () => {
    putAbsence(client, { ...AUSENCIA_1, employeeAbsencesId: 20, date: '2026-11-01' })
    putAbsence(client, { ...AUSENCIA_1, employeeAbsencesId: 21, date: '2026-11-07' })

    expect(semana(SEMANA_1)?.map((item) => item.employeeAbsencesId)).toEqual([1, 20, 21])
  })

  it('reemplaza una ausencia con el mismo id sin duplicarla', () => {
    putAbsence(client, { ...AUSENCIA_1, absenceType: 'Off' })

    expect(semana(SEMANA_1)).toEqual([{ ...AUSENCIA_1, absenceType: 'Off' }])
  })

  it('con replaceId sustituye la ausencia temporal por la real', () => {
    const temporal: Absence = { ...AUSENCIA_1, employeeAbsencesId: -1, employeesId: 4, date: '2026-11-05' }
    putAbsence(client, temporal)
    const real: Absence = { ...temporal, employeeAbsencesId: 50 }

    putAbsence(client, real, -1)

    expect(semana(SEMANA_1)).toEqual([AUSENCIA_1, real])
  })

  it('una fecha fuera de todas las semanas cacheadas no se añade a ninguna', () => {
    putAbsence(client, { ...AUSENCIA_1, employeeAbsencesId: 30, date: '2026-12-01' })

    expect(semana(SEMANA_1)).toEqual([AUSENCIA_1])
    expect(semana(SEMANA_2)).toEqual([AUSENCIA_2])
  })

  it('no da datos a una semana que todavía no tiene', () => {
    const cargando = queryKeys.absences('2026-11-15', '2026-11-21')
    void client.prefetchQuery({ queryKey: cargando, queryFn: () => new Promise<Absence[]>(() => {}) })

    putAbsence(client, { ...AUSENCIA_1, employeeAbsencesId: 40, date: '2026-11-16' })

    expect(semana(cargando)).toBeUndefined()
  })
})

describe('removeCachedAbsence', () => {
  it('quita la ausencia de su semana sin tocar las demás', () => {
    removeCachedAbsence(client, 1)

    expect(semana(SEMANA_1)).toEqual([])
    expect(semana(SEMANA_2)).toEqual([AUSENCIA_2])
  })

  it('quita el id de todas las semanas cacheadas', () => {
    client.setQueryData(SEMANA_2, [AUSENCIA_2, { ...AUSENCIA_1 }])

    removeCachedAbsence(client, 1)

    expect(semana(SEMANA_1)).toEqual([])
    expect(semana(SEMANA_2)).toEqual([AUSENCIA_2])
  })

  it('un id que no está en la caché no cambia nada', () => {
    removeCachedAbsence(client, 999)

    expect(semana(SEMANA_1)).toEqual([AUSENCIA_1])
    expect(semana(SEMANA_2)).toEqual([AUSENCIA_2])
  })
})
