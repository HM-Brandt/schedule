// Tests de las mutaciones optimistas (tarea 4.2 de `schedule-assign`) con `msw/node`.
//
// Cubren "Respuesta inmediata y error al guardar" de `specs/weekly-schedule-board/spec.md`
// y la decisión 4 de `design.md`: el cambio se ve en la caché `['schedules', from, to]`
// antes de que responda el servidor y, si este responde con error, la caché vuelve al
// estado anterior y se emite el mensaje de error.
//
// Para comprobar el estado antes de la respuesta, `pausar` registra delante un manejador
// que espera a que el test llame a `liberar()`. Después, o bien responde con un 500, o
// bien no devuelve nada y MSW pasa la petición al manejador de la semilla.
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import type { ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHandlers } from '../mocks/handlers'
import { createSeed } from '../mocks/seed'
import { useCreateSchedule, useDeleteSchedule, useReplaceEmployees, useUpdateSchedule } from './mutations'
import { queryKeys, useWeekSchedules } from './queries'
import { createQueryClient } from './queryClient'
import type { Schedule } from './types'

/** Martes 2026-11-03: la semilla arma la semana del 2026-11-01 al 2026-11-07. */
const HOY = new Date(2026, 10, 3)

const SEMANA_1 = queryKeys.schedules('2026-11-01', '2026-11-07')
const SEMANA_2 = queryKeys.schedules('2026-11-08', '2026-11-14')

const MENSAJE_500 = 'Fallo simulado del servidor'

const server = setupServer()

let semilla: ReturnType<typeof createSeed>
let client: QueryClient
let onMutationError: ReturnType<typeof vi.fn<(mensaje: string) => void>>

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
})

beforeEach(() => {
  semilla = createSeed(HOY)
  server.resetHandlers(...createHandlers(semilla))
  onMutationError = vi.fn<(mensaje: string) => void>()
  client = createQueryClient({ onMutationError })
  // Semana visible con las programaciones 1 a 4 de la semilla, y la siguiente vacía.
  client.setQueryData(SEMANA_1, structuredClone(semilla.schedules))
  client.setQueryData(SEMANA_2, [])
})

afterEach(() => {
  client.clear()
})

afterAll(() => {
  server.close()
})

function envoltorio({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const semana = (clave: readonly unknown[]) => client.getQueryData<Schedule[]>(clave)

const ids = (clave: readonly unknown[]) => semana(clave)?.map((item) => item.jobSchedulesId)

/** Copia de las dos semanas cacheadas, para comparar tras revertir. */
function estadoCache() {
  return { semana1: structuredClone(semana(SEMANA_1)), semana2: structuredClone(semana(SEMANA_2)) }
}

type Metodo = 'post' | 'patch' | 'delete' | 'put'

/**
 * Detiene las peticiones `metodo ruta` hasta llamar a la función devuelta. Con
 * `responder`, contesta con su respuesta; sin él, deja que conteste la semilla.
 */
function pausar(metodo: Metodo, ruta: string, responder?: () => Response): () => void {
  let liberar!: () => void
  const pausa = new Promise<void>((resolve) => {
    liberar = resolve
  })
  server.use(
    http[metodo](ruta, async () => {
      await pausa
      return responder?.()
    }),
  )
  return liberar
}

const error500 = () => HttpResponse.json({ error: MENSAJE_500 }, { status: 500 })

/** El texto de la interfaz va en inglés y el `error` del servidor se añade tal cual. */
const MENSAJE_ESPERADO = `Couldn't save the change. ${MENSAJE_500}`

describe('useCreateSchedule', () => {
  it('muestra la programación con id temporal antes de la respuesta y luego la sustituye por la real', async () => {
    const liberar = pausar('post', '/v1/schedules')
    const trabajo = semilla.jobs[13]
    const { result } = renderHook(() => useCreateSchedule(), { wrapper: envoltorio })

    act(() => {
      result.current.mutate({ job: trabajo, date: '2026-11-05', startTime: '07:00', employeesIds: [1] })
    })

    await waitFor(() => expect(semana(SEMANA_1)).toHaveLength(5))
    const temporal = semana(SEMANA_1)?.find((item) => item.job.jobsId === trabajo.jobsId)
    expect(temporal?.jobSchedulesId).toBeLessThan(0)
    expect(temporal).toMatchObject({ job: trabajo, date: '2026-11-05', startTime: '07:00', employeesIds: [1] })
    expect(semana(SEMANA_2)).toEqual([])
    expect(result.current.isPending).toBe(true)

    liberar()

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(ids(SEMANA_1)?.every((id) => id > 0)).toBe(true)
    expect(semana(SEMANA_1)).toHaveLength(5)
    expect(semana(SEMANA_1)).toContainEqual({
      jobSchedulesId: 5,
      job: trabajo,
      date: '2026-11-05',
      startTime: '07:00',
      employeesIds: [1],
      scheduleComment: null,
    })
    expect(onMutationError).not.toHaveBeenCalled()
  })

  it('sin employeesIds la programación optimista tiene la lista vacía', async () => {
    const liberar = pausar('post', '/v1/schedules')
    const { result } = renderHook(() => useCreateSchedule(), { wrapper: envoltorio })

    act(() => {
      result.current.mutate({ job: semilla.jobs[0], date: '2026-11-06', startTime: '07:00' })
    })

    await waitFor(() => expect(semana(SEMANA_1)).toHaveLength(5))
    expect(semana(SEMANA_1)?.find((item) => item.jobSchedulesId < 0)?.employeesIds).toEqual([])
    liberar()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('sin scheduleComment la programación optimista y la real tienen scheduleComment null', async () => {
    const liberar = pausar('post', '/v1/schedules')
    const { result } = renderHook(() => useCreateSchedule(), { wrapper: envoltorio })

    act(() => {
      result.current.mutate({ job: semilla.jobs[0], date: '2026-11-06', startTime: '07:00' })
    })

    await waitFor(() => expect(semana(SEMANA_1)).toHaveLength(5))
    expect(semana(SEMANA_1)?.find((item) => item.jobSchedulesId < 0)?.scheduleComment).toBeNull()
    liberar()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(semana(SEMANA_1)?.find((item) => item.jobSchedulesId === 5)?.scheduleComment).toBeNull()
  })

  it('con scheduleComment la programación optimista lo muestra y el servidor lo guarda', async () => {
    const liberar = pausar('post', '/v1/schedules')
    const { result } = renderHook(() => useCreateSchedule(), { wrapper: envoltorio })

    act(() => {
      result.current.mutate({ job: semilla.jobs[0], date: '2026-11-06', startTime: '07:00', scheduleComment: 'Llevar escalera' })
    })

    await waitFor(() => expect(semana(SEMANA_1)).toHaveLength(5))
    expect(semana(SEMANA_1)?.find((item) => item.jobSchedulesId < 0)?.scheduleComment).toBe('Llevar escalera')
    liberar()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.scheduleComment).toBe('Llevar escalera')
    expect(semana(SEMANA_1)?.find((item) => item.jobSchedulesId === 5)?.scheduleComment).toBe('Llevar escalera')
  })

  it('pone la programación en la semana cacheada que contiene su fecha', async () => {
    const { result } = renderHook(() => useCreateSchedule(), { wrapper: envoltorio })

    act(() => {
      result.current.mutate({ job: semilla.jobs[0], date: '2026-11-12', startTime: '07:00' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(ids(SEMANA_1)).toEqual([1, 2, 3, 4])
    expect(ids(SEMANA_2)).toEqual([5])
  })

  it('ante un 500 la caché vuelve al estado anterior y se emite el mensaje de error', async () => {
    const antes = estadoCache()
    const liberar = pausar('post', '/v1/schedules', error500)
    const { result } = renderHook(() => useCreateSchedule(), { wrapper: envoltorio })

    act(() => {
      result.current.mutate({ job: semilla.jobs[13], date: '2026-11-05', startTime: '07:00' })
    })

    await waitFor(() => expect(semana(SEMANA_1)).toHaveLength(5))
    liberar()

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(estadoCache()).toEqual(antes)
    expect(onMutationError).toHaveBeenCalledTimes(1)
    expect(onMutationError).toHaveBeenCalledWith(MENSAJE_ESPERADO)
  })

  it('al terminar invalida las semanas cacheadas', async () => {
    const { result } = renderHook(() => useCreateSchedule(), { wrapper: envoltorio })

    act(() => {
      result.current.mutate({ job: semilla.jobs[0], date: '2026-11-05', startTime: '07:00' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(client.getQueryState(SEMANA_1)?.isInvalidated).toBe(true)
    expect(client.getQueryState(SEMANA_2)?.isInvalidated).toBe(true)
  })
})

describe('useUpdateSchedule', () => {
  it('mueve la programación de día antes de la respuesta y conserva sus empleados', async () => {
    const liberar = pausar('patch', '/v1/schedules/:id')
    const { result } = renderHook(() => useUpdateSchedule(), { wrapper: envoltorio })

    act(() => {
      result.current.mutate({ id: 1, changes: { date: '2026-11-05' } })
    })

    await waitFor(() => expect(semana(SEMANA_1)?.find((item) => item.jobSchedulesId === 1)?.date).toBe('2026-11-05'))
    expect(semana(SEMANA_1)?.find((item) => item.jobSchedulesId === 1)).toMatchObject({
      startTime: '07:00',
      employeesIds: [3, 5],
    })
    expect(semana(SEMANA_1)).toHaveLength(4)
    expect(result.current.isPending).toBe(true)

    liberar()

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(semana(SEMANA_1)?.find((item) => item.jobSchedulesId === 1)?.date).toBe('2026-11-05')
    expect(onMutationError).not.toHaveBeenCalled()
  })

  it('cambia la hora de inicio antes de la respuesta', async () => {
    const liberar = pausar('patch', '/v1/schedules/:id')
    const { result } = renderHook(() => useUpdateSchedule(), { wrapper: envoltorio })

    act(() => {
      result.current.mutate({ id: 2, changes: { startTime: '10:30' } })
    })

    await waitFor(() => expect(semana(SEMANA_1)?.find((item) => item.jobSchedulesId === 2)?.startTime).toBe('10:30'))
    liberar()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('cambia el comentario antes de la respuesta y conserva la fecha, la hora y los empleados', async () => {
    const liberar = pausar('patch', '/v1/schedules/:id')
    const { result } = renderHook(() => useUpdateSchedule(), { wrapper: envoltorio })

    act(() => {
      result.current.mutate({ id: 1, changes: { scheduleComment: 'Llevar andamio' } })
    })

    await waitFor(() =>
      expect(semana(SEMANA_1)?.find((item) => item.jobSchedulesId === 1)?.scheduleComment).toBe('Llevar andamio'),
    )
    expect(semana(SEMANA_1)?.find((item) => item.jobSchedulesId === 1)).toMatchObject({
      date: '2026-11-02',
      startTime: '07:00',
      employeesIds: [3, 5],
    })
    liberar()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.scheduleComment).toBe('Llevar andamio')
  })

  it('ante un 500 al cambiar el comentario vuelve el comentario anterior y se emite el mensaje de error', async () => {
    const antes = estadoCache()
    const liberar = pausar('patch', '/v1/schedules/:id', error500)
    const { result } = renderHook(() => useUpdateSchedule(), { wrapper: envoltorio })

    act(() => {
      result.current.mutate({ id: 1, changes: { scheduleComment: null } })
    })

    await waitFor(() => expect(semana(SEMANA_1)?.find((item) => item.jobSchedulesId === 1)?.scheduleComment).toBeNull())
    liberar()

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(semana(SEMANA_1)?.find((item) => item.jobSchedulesId === 1)?.scheduleComment).toBe('Llevar escalera')
    expect(estadoCache()).toEqual(antes)
    expect(onMutationError).toHaveBeenCalledWith(MENSAJE_ESPERADO)
  })

  it('mover a una fecha de otra semana cacheada la quita de una y la pone en la otra', async () => {
    const liberar = pausar('patch', '/v1/schedules/:id')
    const { result } = renderHook(() => useUpdateSchedule(), { wrapper: envoltorio })

    act(() => {
      result.current.mutate({ id: 1, changes: { date: '2026-11-10', startTime: '08:00' } })
    })

    await waitFor(() => expect(ids(SEMANA_2)).toEqual([1]))
    expect(ids(SEMANA_1)).toEqual([2, 3, 4])
    expect(semana(SEMANA_2)?.[0]).toMatchObject({ date: '2026-11-10', startTime: '08:00', employeesIds: [3, 5] })

    liberar()

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(ids(SEMANA_1)).toEqual([2, 3, 4])
    expect(ids(SEMANA_2)).toEqual([1])
  })

  it('fallo al mover: ante un 500 vuelve a su día original y se emite el mensaje de error', async () => {
    const antes = estadoCache()
    const liberar = pausar('patch', '/v1/schedules/:id', error500)
    const { result } = renderHook(() => useUpdateSchedule(), { wrapper: envoltorio })

    act(() => {
      result.current.mutate({ id: 1, changes: { date: '2026-11-05' } })
    })

    await waitFor(() => expect(semana(SEMANA_1)?.find((item) => item.jobSchedulesId === 1)?.date).toBe('2026-11-05'))
    liberar()

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(semana(SEMANA_1)?.find((item) => item.jobSchedulesId === 1)?.date).toBe('2026-11-02')
    expect(estadoCache()).toEqual(antes)
    expect(onMutationError).toHaveBeenCalledTimes(1)
    expect(onMutationError).toHaveBeenCalledWith(MENSAJE_ESPERADO)
  })

  it('ante un 500 al mover a otra semana, las dos semanas vuelven al estado anterior', async () => {
    const antes = estadoCache()
    const liberar = pausar('patch', '/v1/schedules/:id', error500)
    const { result } = renderHook(() => useUpdateSchedule(), { wrapper: envoltorio })

    act(() => {
      result.current.mutate({ id: 1, changes: { date: '2026-11-10' } })
    })

    await waitFor(() => expect(ids(SEMANA_2)).toEqual([1]))
    liberar()

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(estadoCache()).toEqual(antes)
    expect(onMutationError).toHaveBeenCalledWith(MENSAJE_ESPERADO)
  })

  it('con una semana visible montada, tras guardar vuelve a pedirla al servidor', async () => {
    const pedidas: string[] = []
    server.use(
      http.get('/v1/schedules', ({ request }) => {
        pedidas.push(new URL(request.url).search)
      }),
    )
    const { result } = renderHook(
      () => ({ semanaVisible: useWeekSchedules('2026-11-01', '2026-11-07'), mover: useUpdateSchedule() }),
      { wrapper: envoltorio },
    )
    await waitFor(() => expect(result.current.semanaVisible.isFetching).toBe(false))
    const peticionesPrevias = pedidas.length

    act(() => {
      result.current.mover.mutate({ id: 1, changes: { date: '2026-11-05' } })
    })

    await waitFor(() => expect(result.current.mover.isSuccess).toBe(true))
    await waitFor(() => expect(pedidas.length).toBeGreaterThan(peticionesPrevias))
    await waitFor(() => expect(result.current.semanaVisible.isFetching).toBe(false))
    expect(result.current.semanaVisible.data?.find((item) => item.jobSchedulesId === 1)?.date).toBe('2026-11-05')
  })
})

describe('useDeleteSchedule', () => {
  it('quita la programación antes de la respuesta', async () => {
    const liberar = pausar('delete', '/v1/schedules/:id')
    const { result } = renderHook(() => useDeleteSchedule(), { wrapper: envoltorio })

    act(() => {
      result.current.mutate(4)
    })

    await waitFor(() => expect(ids(SEMANA_1)).toEqual([1, 2, 3]))
    expect(result.current.isPending).toBe(true)

    liberar()

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(ids(SEMANA_1)).toEqual([1, 2, 3])
    expect(onMutationError).not.toHaveBeenCalled()
  })

  it('ante un 500 la programación vuelve y se emite el mensaje de error', async () => {
    const antes = estadoCache()
    const liberar = pausar('delete', '/v1/schedules/:id', error500)
    const { result } = renderHook(() => useDeleteSchedule(), { wrapper: envoltorio })

    act(() => {
      result.current.mutate(1)
    })

    await waitFor(() => expect(ids(SEMANA_1)).toEqual([2, 3, 4]))
    liberar()

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(estadoCache()).toEqual(antes)
    expect(onMutationError).toHaveBeenCalledTimes(1)
    expect(onMutationError).toHaveBeenCalledWith(MENSAJE_ESPERADO)
  })
})

describe('useReplaceEmployees', () => {
  it('reemplaza los empleados antes de la respuesta', async () => {
    const liberar = pausar('put', '/v1/schedules/:id/employees')
    const { result } = renderHook(() => useReplaceEmployees(), { wrapper: envoltorio })

    act(() => {
      result.current.mutate({ id: 3, employeesIds: [1, 2] })
    })

    await waitFor(() => expect(semana(SEMANA_1)?.find((item) => item.jobSchedulesId === 3)?.employeesIds).toEqual([1, 2]))
    expect(semana(SEMANA_1)?.find((item) => item.jobSchedulesId === 3)).toMatchObject({ date: '2026-11-03', startTime: '07:00' })
    expect(result.current.isPending).toBe(true)

    liberar()

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(semana(SEMANA_1)?.find((item) => item.jobSchedulesId === 3)?.employeesIds).toEqual([1, 2])
    expect(onMutationError).not.toHaveBeenCalled()
  })

  it('ante un 500 los empleados vuelven a los anteriores y se emite el mensaje de error', async () => {
    const antes = estadoCache()
    const liberar = pausar('put', '/v1/schedules/:id/employees', error500)
    const { result } = renderHook(() => useReplaceEmployees(), { wrapper: envoltorio })

    act(() => {
      result.current.mutate({ id: 1, employeesIds: [] })
    })

    await waitFor(() => expect(semana(SEMANA_1)?.find((item) => item.jobSchedulesId === 1)?.employeesIds).toEqual([]))
    liberar()

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(semana(SEMANA_1)?.find((item) => item.jobSchedulesId === 1)?.employeesIds).toEqual([3, 5])
    expect(estadoCache()).toEqual(antes)
    expect(onMutationError).toHaveBeenCalledTimes(1)
    expect(onMutationError).toHaveBeenCalledWith(MENSAJE_ESPERADO)
  })
})
