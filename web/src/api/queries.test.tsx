// Tests de las consultas de TanStack Query (tarea 4.1 de `schedule-assign`) con `msw/node`.
//
// Los manejadores de `web/src/mocks/handlers.ts` usan rutas relativas y la API de la
// aplicación (`api`) va al mismo origen porque `VITE_API_URL` está vacía en los tests,
// así que no hay CORS de por medio.
//
// Para ver las peticiones, `capturarPeticiones` registra delante un manejador que
// guarda la URL y no devuelve respuesta: MSW pasa entonces la petición al manejador
// de la semilla, que responde.
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import type { ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createHandlers } from '../mocks/handlers'
import { createSeed } from '../mocks/seed'
import { useAuthStore } from '../stores/authStore'
import { queryKeys, useEmployees, useJobs, useMe, useWeekSchedules } from './queries'
import { createQueryClient } from './queryClient'
import type { Schedule } from './types'

/** Martes 2026-11-03: la semilla arma la semana del 2026-11-01 al 2026-11-07. */
const HOY = new Date(2026, 10, 3)

const server = setupServer()

let client: QueryClient

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
})

beforeEach(() => {
  const semilla = createSeed(HOY)
  // Una programación en la semana siguiente para distinguir los rangos.
  semilla.schedules.push({
    jobSchedulesId: 50,
    job: semilla.jobs[0],
    date: '2026-11-10',
    startTime: '07:00',
    employeesIds: [],
    scheduleComment: null,
  })
  server.resetHandlers(...createHandlers(semilla))
  client = createQueryClient()
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

/** Guarda la URL de cada petición GET a `ruta` y deja que la responda la semilla. */
function capturarPeticiones(ruta: string): URL[] {
  const urls: URL[] = []
  server.use(
    http.get(ruta, ({ request }) => {
      urls.push(new URL(request.url))
    }),
  )
  return urls
}

const parametros = (url: URL) => Object.fromEntries(url.searchParams)

describe('queryKeys', () => {
  it('la clave de una semana es ["schedules", from, to]', () => {
    expect(queryKeys.schedules('2026-11-01', '2026-11-07')).toEqual(['schedules', '2026-11-01', '2026-11-07'])
  })

  it('la clave de trabajos incluye la búsqueda', () => {
    expect(queryKeys.jobs('pint')).toEqual(['jobs', 'pint'])
  })

  it('la clave de empleados es ["employees"]', () => {
    expect(queryKeys.employees).toEqual(['employees'])
  })

  it('la clave del usuario actual es ["me"]', () => {
    expect(queryKeys.me).toEqual(['me'])
  })
})

describe('useMe', () => {
  const DEMO = {
    email: 'demo@hmbrandt.com',
    fullName: 'Demo User',
    id: '1',
    roles: [{ id: 1, name: 'Admin' }],
  }

  afterEach(() => {
    useAuthStore.getState().setUser(null)
  })

  it('pide GET /auth/me, devuelve el usuario y lo guarda en el store', async () => {
    const urls = capturarPeticiones('*/auth/me')

    const { result } = renderHook(() => useMe(), { wrapper: envoltorio })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(urls).toHaveLength(1)
    expect(urls[0].pathname).toBe('/auth/me')
    expect(result.current.data).toEqual(DEMO)
    expect(useAuthStore.getState().user).toEqual(DEMO)
    expect(client.getQueryData(queryKeys.me)).toEqual(DEMO)
  })

  it('si la petición falla no guarda ningún usuario', async () => {
    client.setDefaultOptions({ queries: { retry: false } })
    server.use(http.get('*/auth/me', () => HttpResponse.json({ error: 'Fallo' }, { status: 500 })))

    const { result } = renderHook(() => useMe(), { wrapper: envoltorio })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(useAuthStore.getState().user).toBeNull()
  })
})

describe('useWeekSchedules', () => {
  it('pide GET /v1/schedules con from y to de la semana', async () => {
    const urls = capturarPeticiones('/v1/schedules')

    const { result } = renderHook(() => useWeekSchedules('2026-11-01', '2026-11-07'), { wrapper: envoltorio })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(urls).toHaveLength(1)
    expect(urls[0].pathname).toBe('/v1/schedules')
    expect(parametros(urls[0])).toEqual({ from: '2026-11-01', to: '2026-11-07' })
    expect(result.current.data?.map((item) => item.jobSchedulesId)).toEqual([1, 2, 3, 4])
  })

  it('al cambiar de semana pide el nuevo rango y devuelve sus datos', async () => {
    const urls = capturarPeticiones('/v1/schedules')
    const { result, rerender } = renderHook(({ from, to }) => useWeekSchedules(from, to), {
      wrapper: envoltorio,
      initialProps: { from: '2026-11-01', to: '2026-11-07' },
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    rerender({ from: '2026-11-08', to: '2026-11-14' })

    await waitFor(() => expect(result.current.data?.map((item) => item.jobSchedulesId)).toEqual([50]))
    expect(urls.map(parametros)).toEqual([
      { from: '2026-11-01', to: '2026-11-07' },
      { from: '2026-11-08', to: '2026-11-14' },
    ])
  })

  it('guarda cada semana en la caché con su propia clave', async () => {
    const { result, rerender } = renderHook(({ from, to }) => useWeekSchedules(from, to), {
      wrapper: envoltorio,
      initialProps: { from: '2026-11-01', to: '2026-11-07' },
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    rerender({ from: '2026-11-08', to: '2026-11-14' })
    await waitFor(() => expect(result.current.data?.map((item) => item.jobSchedulesId)).toEqual([50]))

    const semana1 = client.getQueryData<Schedule[]>(['schedules', '2026-11-01', '2026-11-07'])
    const semana2 = client.getQueryData<Schedule[]>(['schedules', '2026-11-08', '2026-11-14'])
    expect(semana1?.map((item) => item.jobSchedulesId)).toEqual([1, 2, 3, 4])
    expect(semana2?.map((item) => item.jobSchedulesId)).toEqual([50])
  })
})

describe('useEmployees', () => {
  it('pide GET /v1/employee sin filtro e incluye los inactivos', async () => {
    const urls = capturarPeticiones('/v1/employee')

    const { result } = renderHook(() => useEmployees(), { wrapper: envoltorio })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(urls).toHaveLength(1)
    expect(parametros(urls[0])).toEqual({})
    expect(result.current.data).toHaveLength(10)
    expect(result.current.data?.filter((empleado) => empleado.status === 'Terminated')).toHaveLength(2)
  })
})

describe('useJobs', () => {
  it('con búsqueda vacía no envía search y devuelve todo el catálogo', async () => {
    const urls = capturarPeticiones('/v1/job')

    const { result } = renderHook(() => useJobs(''), { wrapper: envoltorio })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(urls).toHaveLength(1)
    expect(urls[0].searchParams.has('search')).toBe(false)
    expect(result.current.data).toHaveLength(30)
  })

  it('con solo espacios tampoco envía search', async () => {
    const urls = capturarPeticiones('/v1/job')

    const { result } = renderHook(() => useJobs('   '), { wrapper: envoltorio })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(urls[0].searchParams.has('search')).toBe(false)
  })

  it('con texto envía search y devuelve los trabajos que coinciden', async () => {
    const urls = capturarPeticiones('/v1/job')

    const { result } = renderHook(() => useJobs('pintar'), { wrapper: envoltorio })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(parametros(urls[0])).toEqual({ search: 'pintar' })
    expect(result.current.data?.map((trabajo) => trabajo.name)).toEqual(['Pintar oficina', 'Pintar pasillo'])
  })

  it('al cambiar la búsqueda pide de nuevo con el texto recortado', async () => {
    const urls = capturarPeticiones('/v1/job')
    const { result, rerender } = renderHook(({ busqueda }) => useJobs(busqueda), {
      wrapper: envoltorio,
      initialProps: { busqueda: '' },
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    rerender({ busqueda: ' J-1024 ' })

    await waitFor(() => expect(result.current.data?.map((trabajo) => trabajo.number)).toEqual(['J-1024']))
    expect(urls).toHaveLength(2)
    expect(parametros(urls[1])).toEqual({ search: 'J-1024' })
  })
})
