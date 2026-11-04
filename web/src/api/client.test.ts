// Tests del cliente HTTP (tarea 2.3 de `schedule-assign`) con `msw/node`.
//
// En jsdom axios usa el adapter XHR; `setupServer` intercepta XMLHttpRequest, y
// un test lo comprueba. En MSW 3 la opción `onUnhandledRequest` de MSW 2 se llama
// `onUnhandledFrame`: con `'error'`, una petición sin manejador hace fallar el test.
//
// jsdom aplica CORS a la XHR aunque la respuesta sea simulada: el documento está en
// `http://localhost:3000` y la API en `http://api.test`. Sin `Access-Control-Allow-Origin`
// axios recibe un error de red, y PATCH, PUT, DELETE y POST con JSON envían antes una
// petición `OPTIONS`. Por eso el manejador responde como un backend con CORS
// habilitado, igual que pide `docs/api.md`.
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ApiError, createApiClient } from './client'
import type { Employee, Job, Schedule } from './types'

const BASE_URL = 'http://api.test'

const server = setupServer()

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
})

afterEach(() => {
  server.resetHandlers()
  vi.restoreAllMocks()
})

afterAll(() => {
  server.close()
})

// Datos del spec: trabajo 7 "J-1024 Pintar oficina", programación 101, empleados 3 y 5.
const TRABAJO: Job = { id: 7, number: 'J-1024', name: 'Pintar oficina' }

const PROGRAMACION: Schedule = {
  id: 101,
  job: TRABAJO,
  date: '2026-11-02',
  start_time: '08:00',
  employee_ids: [3, 5],
}

const EMPLEADOS: Employee[] = [
  { id: 3, first_name: 'Ana', last_name: 'López', title: 'Pintora', status: 'activo' },
  { id: 5, first_name: 'Luis', last_name: 'Martínez', title: 'Electricista', status: 'activo' },
]

/** Petición recibida por el servidor simulado. */
interface PeticionCapturada {
  method: string
  pathname: string
  searchParams: URLSearchParams
  contentType: string | null
  /** Cuerpo JSON ya interpretado, o `undefined` si la petición no llevó cuerpo. */
  body: unknown
}

/** Cabeceras CORS de un backend que acepta peticiones del origen de jsdom. */
const CABECERAS_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

/** Añade las cabeceras CORS a la respuesta, salvo a un error de red, que no tiene cabeceras. */
function conCors(respuesta: Response): Response {
  if (respuesta.type !== 'error') {
    for (const [nombre, valor] of Object.entries(CABECERAS_CORS)) {
      respuesta.headers.set(nombre, valor)
    }
  }
  return respuesta
}

/**
 * Registra un manejador para cualquier ruta de `BASE_URL` que guarda cada petición
 * y responde con `responder()`. Las peticiones previas `OPTIONS` de CORS se responden
 * sin guardarlas. Devuelve la lista de peticiones capturadas.
 */
function capturar(responder: () => Response): PeticionCapturada[] {
  const capturadas: PeticionCapturada[] = []
  server.use(
    http.all(`${BASE_URL}/*`, async ({ request }) => {
      if (request.method === 'OPTIONS') {
        return new HttpResponse(null, { status: 204, headers: CABECERAS_CORS })
      }
      const url = new URL(request.url)
      const texto = await request.text()
      capturadas.push({
        method: request.method,
        pathname: url.pathname,
        searchParams: url.searchParams,
        contentType: request.headers.get('content-type'),
        body: texto === '' ? undefined : JSON.parse(texto),
      })
      return conCors(responder())
    }),
  )
  return capturadas
}

/** Espera a que la promesa falle y devuelve el error. Falla el test si se resuelve. */
async function capturarError(promesa: Promise<unknown>): Promise<unknown> {
  try {
    await promesa
  } catch (error) {
    return error
  }
  throw new Error('Se esperaba que la petición fallara')
}

describe('createApiClient', () => {
  describe('rutas, métodos, parámetros y cuerpos', () => {
    it('getEmployees sin parámetros: GET /api/employees sin query', async () => {
      const api = createApiClient(BASE_URL)
      const peticiones = capturar(() => HttpResponse.json(EMPLEADOS))

      const empleados = await api.getEmployees()

      expect(peticiones).toHaveLength(1)
      expect(peticiones[0].method).toBe('GET')
      expect(peticiones[0].pathname).toBe('/api/employees')
      expect([...peticiones[0].searchParams]).toEqual([])
      expect(peticiones[0].body).toBeUndefined()
      expect(empleados).toEqual(EMPLEADOS)
    })

    it('getEmployees con status: envía ?status=activo', async () => {
      const api = createApiClient(BASE_URL)
      const peticiones = capturar(() => HttpResponse.json(EMPLEADOS))

      await api.getEmployees({ status: 'activo' })

      expect(peticiones[0].method).toBe('GET')
      expect(peticiones[0].pathname).toBe('/api/employees')
      expect([...peticiones[0].searchParams]).toEqual([['status', 'activo']])
    })

    it('getEmployees con un objeto vacío no envía status', async () => {
      const api = createApiClient(BASE_URL)
      const peticiones = capturar(() => HttpResponse.json(EMPLEADOS))

      await api.getEmployees({})

      expect([...peticiones[0].searchParams]).toEqual([])
    })

    it('getJobs sin parámetros: GET /api/jobs sin query', async () => {
      const api = createApiClient(BASE_URL)
      const peticiones = capturar(() => HttpResponse.json([TRABAJO]))

      const trabajos = await api.getJobs()

      expect(peticiones).toHaveLength(1)
      expect(peticiones[0].method).toBe('GET')
      expect(peticiones[0].pathname).toBe('/api/jobs')
      expect([...peticiones[0].searchParams]).toEqual([])
      expect(trabajos).toEqual([TRABAJO])
    })

    it('getJobs con search: envía ?search=pintar', async () => {
      const api = createApiClient(BASE_URL)
      const peticiones = capturar(() => HttpResponse.json([TRABAJO]))

      const trabajos = await api.getJobs({ search: 'pintar' })

      expect(peticiones[0].method).toBe('GET')
      expect(peticiones[0].pathname).toBe('/api/jobs')
      expect([...peticiones[0].searchParams]).toEqual([['search', 'pintar']])
      expect(trabajos).toEqual([TRABAJO])
    })

    it('getSchedules: GET /api/schedules con from y to', async () => {
      const api = createApiClient(BASE_URL)
      const peticiones = capturar(() => HttpResponse.json([PROGRAMACION]))

      const programaciones = await api.getSchedules({ from: '2026-11-01', to: '2026-11-07' })

      expect(peticiones).toHaveLength(1)
      expect(peticiones[0].method).toBe('GET')
      expect(peticiones[0].pathname).toBe('/api/schedules')
      expect(Object.fromEntries(peticiones[0].searchParams)).toEqual({
        from: '2026-11-01',
        to: '2026-11-07',
      })
      expect(peticiones[0].body).toBeUndefined()
      expect(programaciones).toEqual([PROGRAMACION])
    })

    it('createSchedule: POST /api/schedules con el cuerpo JSON de "Creación válida"', async () => {
      const api = createApiClient(BASE_URL)
      const creada: Schedule = { ...PROGRAMACION, start_time: '07:00', employee_ids: [] }
      const peticiones = capturar(() => HttpResponse.json(creada, { status: 201 }))

      const resultado = await api.createSchedule({ job_id: 7, date: '2026-11-02', start_time: '07:00' })

      expect(peticiones).toHaveLength(1)
      expect(peticiones[0].method).toBe('POST')
      expect(peticiones[0].pathname).toBe('/api/schedules')
      expect(peticiones[0].contentType).toContain('application/json')
      expect(peticiones[0].body).toEqual({ job_id: 7, date: '2026-11-02', start_time: '07:00' })
      expect(resultado).toEqual(creada)
    })

    it('createSchedule envía employee_ids cuando vienen', async () => {
      const api = createApiClient(BASE_URL)
      const peticiones = capturar(() => HttpResponse.json(PROGRAMACION, { status: 201 }))

      await api.createSchedule({ job_id: 7, date: '2026-11-02', start_time: '08:00', employee_ids: [3, 5] })

      expect(peticiones[0].body).toEqual({
        job_id: 7,
        date: '2026-11-02',
        start_time: '08:00',
        employee_ids: [3, 5],
      })
    })

    it('updateSchedule: PATCH /api/schedules/101 con el cuerpo de "Mover a otro día"', async () => {
      const api = createApiClient(BASE_URL)
      const movida: Schedule = { ...PROGRAMACION, date: '2026-11-04' }
      const peticiones = capturar(() => HttpResponse.json(movida))

      const resultado = await api.updateSchedule(101, { date: '2026-11-04' })

      expect(peticiones).toHaveLength(1)
      expect(peticiones[0].method).toBe('PATCH')
      expect(peticiones[0].pathname).toBe('/api/schedules/101')
      expect(peticiones[0].contentType).toContain('application/json')
      expect(peticiones[0].body).toEqual({ date: '2026-11-04' })
      expect(resultado).toEqual(movida)
    })

    it('updateSchedule envía solo start_time cuando solo cambia la hora', async () => {
      const api = createApiClient(BASE_URL)
      const peticiones = capturar(() => HttpResponse.json({ ...PROGRAMACION, start_time: '10:30' }))

      const resultado = await api.updateSchedule(101, { start_time: '10:30' })

      expect(peticiones[0].body).toEqual({ start_time: '10:30' })
      expect(resultado.start_time).toBe('10:30')
    })

    it('deleteSchedule: DELETE /api/schedules/101 y resuelve undefined con un 204', async () => {
      const api = createApiClient(BASE_URL)
      const peticiones = capturar(() => new HttpResponse(null, { status: 204 }))

      const resultado = await api.deleteSchedule(101)

      expect(peticiones).toHaveLength(1)
      expect(peticiones[0].method).toBe('DELETE')
      expect(peticiones[0].pathname).toBe('/api/schedules/101')
      expect(peticiones[0].body).toBeUndefined()
      expect(resultado).toBeUndefined()
    })

    it('replaceScheduleEmployees: PUT /api/schedules/101/employees con el cuerpo de "Reemplazo"', async () => {
      const api = createApiClient(BASE_URL)
      const reemplazada: Schedule = { ...PROGRAMACION, employee_ids: [5, 8] }
      const peticiones = capturar(() => HttpResponse.json(reemplazada))

      const resultado = await api.replaceScheduleEmployees(101, { employee_ids: [5, 8] })

      expect(peticiones).toHaveLength(1)
      expect(peticiones[0].method).toBe('PUT')
      expect(peticiones[0].pathname).toBe('/api/schedules/101/employees')
      expect(peticiones[0].contentType).toContain('application/json')
      expect(peticiones[0].body).toEqual({ employee_ids: [5, 8] })
      expect(resultado).toEqual(reemplazada)
    })

    it('replaceScheduleEmployees envía una lista vacía para retirar a todos', async () => {
      const api = createApiClient(BASE_URL)
      const peticiones = capturar(() => HttpResponse.json({ ...PROGRAMACION, employee_ids: [] }))

      const resultado = await api.replaceScheduleEmployees(101, { employee_ids: [] })

      expect(peticiones[0].body).toEqual({ employee_ids: [] })
      expect(resultado.employee_ids).toEqual([])
    })

    it('las peticiones van por XMLHttpRequest y MSW las intercepta', async () => {
      const api = createApiClient(BASE_URL)
      const abrir = vi.spyOn(XMLHttpRequest.prototype, 'open')
      const peticiones = capturar(() => HttpResponse.json([TRABAJO]))

      await api.getJobs()

      expect(abrir).toHaveBeenCalled()
      expect(peticiones).toHaveLength(1)
    })
  })

  describe('normalización de start_time "08:00:00" a "08:00"', () => {
    const conSegundos = { ...PROGRAMACION, start_time: '08:00:00' }

    it('en getSchedules', async () => {
      const api = createApiClient(BASE_URL)
      capturar(() => HttpResponse.json([conSegundos]))

      const programaciones = await api.getSchedules({ from: '2026-11-01', to: '2026-11-07' })

      expect(programaciones).toEqual([PROGRAMACION])
    })

    it('en createSchedule', async () => {
      const api = createApiClient(BASE_URL)
      capturar(() => HttpResponse.json(conSegundos, { status: 201 }))

      const creada = await api.createSchedule({ job_id: 7, date: '2026-11-02', start_time: '08:00' })

      expect(creada).toEqual(PROGRAMACION)
    })

    it('en updateSchedule', async () => {
      const api = createApiClient(BASE_URL)
      capturar(() => HttpResponse.json(conSegundos))

      const actualizada = await api.updateSchedule(101, { start_time: '08:00' })

      expect(actualizada).toEqual(PROGRAMACION)
    })

    it('en replaceScheduleEmployees', async () => {
      const api = createApiClient(BASE_URL)
      capturar(() => HttpResponse.json(conSegundos))

      const reemplazada = await api.replaceScheduleEmployees(101, { employee_ids: [3, 5] })

      expect(reemplazada).toEqual(PROGRAMACION)
    })
  })

  describe('errores tipados', () => {
    it('404 con {"error": "No existe"} (PATCH /api/schedules/99999) da ApiError not_found', async () => {
      const api = createApiClient(BASE_URL)
      capturar(() => HttpResponse.json({ error: 'No existe' }, { status: 404 }))

      const error = await capturarError(api.updateSchedule(99999, { date: '2026-11-04' }))

      expect(error).toBeInstanceOf(ApiError)
      expect(error).toBeInstanceOf(Error)
      expect(error).toMatchObject({ name: 'ApiError', kind: 'not_found', status: 404, message: 'No existe' })
    })

    it('404 sin cuerpo da el mensaje por defecto', async () => {
      const api = createApiClient(BASE_URL)
      capturar(() => new HttpResponse(null, { status: 404 }))

      const error = await capturarError(api.deleteSchedule(99999))

      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({ kind: 'not_found', status: 404, message: 'No se encontró el recurso' })
    })

    it('422 con {"error": "..."} da ApiError validation con ese mensaje', async () => {
      const api = createApiClient(BASE_URL)
      capturar(() => HttpResponse.json({ error: 'El empleado 9 está inactivo' }, { status: 422 }))

      const error = await capturarError(
        api.createSchedule({ job_id: 7, date: '2026-11-02', start_time: '08:00', employee_ids: [3, 9] }),
      )

      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({
        kind: 'validation',
        status: 422,
        message: 'El empleado 9 está inactivo',
      })
    })

    it.each([
      ['sin cuerpo', () => new HttpResponse(null, { status: 422 })],
      ['con {"error": ""}', () => HttpResponse.json({ error: '' }, { status: 422 })],
    ])('422 %s da el mensaje por defecto', async (_descripcion, responder) => {
      const api = createApiClient(BASE_URL)
      capturar(responder)

      const error = await capturarError(api.getSchedules({ from: '2026-11-07', to: '2026-11-01' }))

      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({
        kind: 'validation',
        status: 422,
        message: 'Los datos enviados no son válidos',
      })
    })

    it('500 da ApiError http con "Error del servidor (500)"', async () => {
      const api = createApiClient(BASE_URL)
      capturar(() => new HttpResponse(null, { status: 500 }))

      const error = await capturarError(api.replaceScheduleEmployees(101, { employee_ids: [5, 8] }))

      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({ kind: 'http', status: 500, message: 'Error del servidor (500)' })
    })

    it('un error de red da ApiError network sin status', async () => {
      const api = createApiClient(BASE_URL)
      capturar(() => HttpResponse.error())

      const error = await capturarError(api.getEmployees())

      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({
        kind: 'network',
        status: null,
        message: 'No se pudo conectar con el servidor',
      })
    })
  })
})
