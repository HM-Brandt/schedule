// Tests de las utilidades de caché de programaciones (tarea 4.2 de `schedule-assign`).
//
// Las semanas se guardan en la caché con la clave `['schedules', from, to]`
// (decisión 4 de `design.md`).
import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it } from 'vitest'
import { queryKeys } from './queries'
import {
  findCachedSchedule,
  nextTempId,
  putSchedule,
  removeCachedSchedule,
  snapshotSchedules,
} from './scheduleCache'
import type { Job, Schedule } from './types'
import { trabajo } from '../test/fabricas'

const PINTAR_OFICINA: Job = trabajo(7, 'J-1024', 'Pintar oficina')

const SEMANA_1 = queryKeys.schedules('2026-11-01', '2026-11-07')
const SEMANA_2 = queryKeys.schedules('2026-11-08', '2026-11-14')

const LUNES_1: Schedule = { jobSchedulesId: 1, job: PINTAR_OFICINA, date: '2026-11-02', startTime: '07:00', employeesIds: [3, 5], scheduleComment: null }
const MARTES_1: Schedule = { jobSchedulesId: 2, job: PINTAR_OFICINA, date: '2026-11-03', startTime: '08:00', employeesIds: [], scheduleComment: null }
const LUNES_2: Schedule = { jobSchedulesId: 3, job: PINTAR_OFICINA, date: '2026-11-09', startTime: '07:00', employeesIds: [3], scheduleComment: null }

let client: QueryClient

beforeEach(() => {
  client = new QueryClient()
  client.setQueryData(SEMANA_1, [LUNES_1, MARTES_1])
  client.setQueryData(SEMANA_2, [LUNES_2])
})

const semana = (clave: readonly unknown[]) => client.getQueryData<Schedule[]>(clave)

describe('snapshotSchedules', () => {
  it('la instantánea contiene todas las semanas cacheadas', () => {
    const instantanea = snapshotSchedules(client)

    expect(instantanea).toHaveLength(2)
    expect(instantanea).toContainEqual([SEMANA_1, [LUNES_1, MARTES_1]])
    expect(instantanea).toContainEqual([SEMANA_2, [LUNES_2]])
  })

  it('no incluye otras consultas', () => {
    client.setQueryData(['employees'], [])

    expect(snapshotSchedules(client)).toHaveLength(2)
  })
})

describe('findCachedSchedule', () => {
  it('encuentra una programación en cualquier semana cacheada', () => {
    expect(findCachedSchedule(client, 2)).toEqual(MARTES_1)
    expect(findCachedSchedule(client, 3)).toEqual(LUNES_2)
  })

  it('devuelve undefined si no está en la caché', () => {
    expect(findCachedSchedule(client, 999)).toBeUndefined()
  })
})

describe('putSchedule', () => {
  it('añade una programación nueva solo a la semana que contiene su fecha', () => {
    const nueva: Schedule = { ...LUNES_1, jobSchedulesId: 10, date: '2026-11-05' }

    putSchedule(client, nueva)

    expect(semana(SEMANA_1)).toContainEqual(nueva)
    expect(semana(SEMANA_1)).toHaveLength(3)
    expect(semana(SEMANA_2)).toEqual([LUNES_2])
  })

  it('reemplaza una programación existente sin duplicarla', () => {
    putSchedule(client, { ...LUNES_1, startTime: '10:30' })

    expect(semana(SEMANA_1)).toHaveLength(2)
    expect(findCachedSchedule(client, 1)?.startTime).toBe('10:30')
  })

  it('al cambiar la fecha a otra semana la quita de la original y la pone en la nueva', () => {
    putSchedule(client, { ...LUNES_1, date: '2026-11-10' })

    expect(semana(SEMANA_1)).toEqual([MARTES_1])
    expect(semana(SEMANA_2)).toContainEqual({ ...LUNES_1, date: '2026-11-10' })
  })

  it('incluye los extremos del rango (domingo y sábado)', () => {
    putSchedule(client, { ...LUNES_1, jobSchedulesId: 20, date: '2026-11-01' })
    putSchedule(client, { ...LUNES_1, jobSchedulesId: 21, date: '2026-11-07' })

    expect(semana(SEMANA_1)?.map((item) => item.jobSchedulesId)).toEqual([1, 2, 20, 21])
  })

  it('con replaceId sustituye la programación temporal por la real', () => {
    const temporal: Schedule = { ...LUNES_1, jobSchedulesId: -1, date: '2026-11-04' }
    putSchedule(client, temporal)
    const real: Schedule = { ...temporal, jobSchedulesId: 50 }

    putSchedule(client, real, -1)

    expect(findCachedSchedule(client, -1)).toBeUndefined()
    expect(semana(SEMANA_1)).toContainEqual(real)
    expect(semana(SEMANA_1)).toHaveLength(3)
  })

  it('una fecha fuera de todas las semanas cacheadas no se añade a ninguna', () => {
    putSchedule(client, { ...LUNES_1, jobSchedulesId: 30, date: '2026-12-01' })

    expect(semana(SEMANA_1)).toEqual([LUNES_1, MARTES_1])
    expect(semana(SEMANA_2)).toEqual([LUNES_2])
  })

  it('no da datos a una semana que todavía se está cargando', () => {
    const cargando = queryKeys.schedules('2026-11-15', '2026-11-21')
    void client.prefetchQuery({ queryKey: cargando, queryFn: () => new Promise<Schedule[]>(() => {}) })

    putSchedule(client, { ...LUNES_1, jobSchedulesId: 40, date: '2026-11-16' })

    expect(semana(cargando)).toBeUndefined()
  })
})

describe('removeCachedSchedule', () => {
  it('quita la programación de su semana sin tocar las demás', () => {
    removeCachedSchedule(client, 1)

    expect(semana(SEMANA_1)).toEqual([MARTES_1])
    expect(semana(SEMANA_2)).toEqual([LUNES_2])
  })

  it('un id que no está en la caché no cambia nada', () => {
    removeCachedSchedule(client, 999)

    expect(semana(SEMANA_1)).toEqual([LUNES_1, MARTES_1])
    expect(semana(SEMANA_2)).toEqual([LUNES_2])
  })
})

describe('nextTempId', () => {
  it('da ids negativos y cada vez menores', () => {
    const primero = nextTempId()
    const segundo = nextTempId()

    expect(primero).toBeLessThan(0)
    expect(segundo).toBeLessThan(primero)
  })
})
