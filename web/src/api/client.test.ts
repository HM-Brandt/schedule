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
import { delay, http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { LOGIN_URL } from '../auth/session'
import { readConfig } from '../config'
import { useAuthStore } from '../stores/authStore'
import type { AuthUser } from '../types'
import { ApiError, createApiClient } from './client'
import type { Employee, Job, ScheduleResponse } from './types'
import { empleado, trabajo } from '../test/fabricas'
import { simularNavegacion } from '../test/navegacion'

const BASE_URL = 'http://api.test'

const server = setupServer()

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
})

// Los tests de rutas y errores parten sin sesión: sin token no se envía `Authorization` y las
// peticiones a otro origen no necesitan permitir esa cabecera en CORS. El estado inicial del
// store se prueba en `stores/authStore.test.ts`; el bloque "autenticación" inicia su propia sesión.
beforeEach(() => {
  useAuthStore.setState({ token: null, refreshToken: null, isAuthenticated: false, user: null })
})

afterEach(() => {
  server.resetHandlers()
  vi.restoreAllMocks()
})

afterAll(() => {
  server.close()
})

// Datos del spec: trabajo 7 "J-1024 Pintar oficina", programación 101, empleados 3 y 5.
const TRABAJO: Job = trabajo(7, 'J-1024', 'Pintar oficina')

/** Programación 101 como la envía el backend: con `jobsId` en lugar del objeto `job`. */
const PROGRAMACION: ScheduleResponse = {
  jobSchedulesId: 101,
  jobsId: 7,
  date: '2026-11-02',
  startTime: '08:00',
  employeesIds: [3, 5],
  scheduleComment: null,
}

const EMPLEADOS: Employee[] = [
  empleado(3, 'Ana', 'López', 'Labor'),
  empleado(5, 'Luis', 'Martínez', 'Labor'),
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

/**
 * Registra un manejador para cualquier URL que guarda la URL completa (sin query) y el método
 * de cada petición y responde según el método: 204 al DELETE, una lista a los GET de listas y
 * la programación al resto. Las `OPTIONS` previas de CORS se responden sin guardarlas.
 */
function capturarUrls(): { method: string; url: string }[] {
  const capturadas: { method: string; url: string }[] = []
  server.use(
    http.all('*', ({ request }) => {
      if (request.method === 'OPTIONS') {
        return new HttpResponse(null, { status: 204, headers: CABECERAS_CORS })
      }
      const url = new URL(request.url)
      capturadas.push({ method: request.method, url: `${url.origin}${url.pathname}` })
      if (request.method === 'DELETE') return conCors(new HttpResponse(null, { status: 204 }))
      if (request.method === 'GET') return conCors(HttpResponse.json([]))
      return conCors(HttpResponse.json(PROGRAMACION))
    }),
  )
  return capturadas
}

/** Llama una vez a cada uno de los siete endpoints del contrato. */
async function llamarLosSieteEndpoints(api: ReturnType<typeof createApiClient>) {
  await api.getEmployees()
  await api.getJobs()
  await api.getSchedules({ from: '2026-11-01', to: '2026-11-07' })
  await api.createSchedule({ jobsId: 7, date: '2026-11-02', startTime: '07:00' })
  await api.updateSchedule(101, { date: '2026-11-04' })
  await api.deleteSchedule(101)
  await api.replaceScheduleEmployees(101, { employeesIds: [5, 8] })
}

describe('createApiClient', () => {
  describe('rutas v1/... y v2/... relativas a la URL base (tarea 11.7)', () => {
    it('escenario "URL base vacía": las siete peticiones van a /v1/... y /v2/... del mismo origen de la página', async () => {
      const api = createApiClient('')
      const peticiones = capturarUrls()

      await llamarLosSieteEndpoints(api)

      const origen = window.location.origin
      expect(peticiones).toEqual([
        { method: 'GET', url: `${origen}/v1/employee` },
        { method: 'GET', url: `${origen}/v1/job` },
        { method: 'GET', url: `${origen}/v2/job-management/schedules` },
        { method: 'POST', url: `${origen}/v2/job-management/schedules` },
        { method: 'PATCH', url: `${origen}/v2/job-management/schedules/101` },
        { method: 'DELETE', url: `${origen}/v2/job-management/schedules/101` },
        { method: 'PUT', url: `${origen}/v2/job-management/schedules/101/employees` },
      ])
    })

    it('con una URL absoluta con prefijo /api las siete peticiones van a https://host/api/v1/..., sin /api/api', async () => {
      const api = createApiClient('https://host/api')
      const peticiones = capturarUrls()

      await llamarLosSieteEndpoints(api)

      expect(peticiones).toEqual([
        { method: 'GET', url: 'https://host/api/v1/employee' },
        { method: 'GET', url: 'https://host/api/v1/job' },
        { method: 'GET', url: 'https://host/api/v2/job-management/schedules' },
        { method: 'POST', url: 'https://host/api/v2/job-management/schedules' },
        { method: 'PATCH', url: 'https://host/api/v2/job-management/schedules/101' },
        { method: 'DELETE', url: 'https://host/api/v2/job-management/schedules/101' },
        { method: 'PUT', url: 'https://host/api/v2/job-management/schedules/101/employees' },
      ])
      for (const { url } of peticiones) {
        expect(url).not.toContain('/api/api')
        expect(url).not.toContain('//v1')
      }
    })

    it('escenario "URL base con prefijo": VITE_API_URL "https://api.ejemplo.com/api/" pide la 101 en .../api/v2/job-management/schedules/101', async () => {
      const api = createApiClient(readConfig({ VITE_API_URL: 'https://api.ejemplo.com/api/' }).apiUrl)
      const peticiones = capturarUrls()

      await api.updateSchedule(101, { date: '2026-11-04' })

      expect(peticiones).toEqual([{ method: 'PATCH', url: 'https://api.ejemplo.com/api/v2/job-management/schedules/101' }])
    })

    it('con la URL base terminada en "/" pone una sola "/" entre la base y la ruta', async () => {
      const api = createApiClient('https://host/api/')
      const peticiones = capturarUrls()

      await api.getEmployees()

      expect(peticiones).toEqual([{ method: 'GET', url: 'https://host/api/v1/employee' }])
    })
  })

  describe('rutas, métodos, parámetros y cuerpos', () => {
    it('getEmployees sin parámetros: GET /v1/employee sin query', async () => {
      const api = createApiClient(BASE_URL)
      const peticiones = capturar(() => HttpResponse.json(EMPLEADOS))

      const empleados = await api.getEmployees()

      expect(peticiones).toHaveLength(1)
      expect(peticiones[0].method).toBe('GET')
      expect(peticiones[0].pathname).toBe('/v1/employee')
      expect([...peticiones[0].searchParams]).toEqual([])
      expect(peticiones[0].body).toBeUndefined()
      expect(empleados).toEqual(EMPLEADOS)
    })

    it('getEmployees con status: envía ?status=Active', async () => {
      const api = createApiClient(BASE_URL)
      const peticiones = capturar(() => HttpResponse.json(EMPLEADOS))

      await api.getEmployees({ status: 'Active' })

      expect(peticiones[0].method).toBe('GET')
      expect(peticiones[0].pathname).toBe('/v1/employee')
      expect([...peticiones[0].searchParams]).toEqual([['status', 'Active']])
    })

    it('getEmployees con un objeto vacío no envía status', async () => {
      const api = createApiClient(BASE_URL)
      const peticiones = capturar(() => HttpResponse.json(EMPLEADOS))

      await api.getEmployees({})

      expect([...peticiones[0].searchParams]).toEqual([])
    })

    it('getJobs sin parámetros: GET /v1/job sin query', async () => {
      const api = createApiClient(BASE_URL)
      const peticiones = capturar(() => HttpResponse.json([TRABAJO]))

      const trabajos = await api.getJobs()

      expect(peticiones).toHaveLength(1)
      expect(peticiones[0].method).toBe('GET')
      expect(peticiones[0].pathname).toBe('/v1/job')
      expect([...peticiones[0].searchParams]).toEqual([])
      expect(trabajos).toEqual([TRABAJO])
    })

    it('getSchedules: GET /v2/job-management/schedules con from y to', async () => {
      const api = createApiClient(BASE_URL)
      const peticiones = capturar(() => HttpResponse.json([PROGRAMACION]))

      const programaciones = await api.getSchedules({ from: '2026-11-01', to: '2026-11-07' })

      expect(peticiones).toHaveLength(1)
      expect(peticiones[0].method).toBe('GET')
      expect(peticiones[0].pathname).toBe('/v2/job-management/schedules')
      expect(Object.fromEntries(peticiones[0].searchParams)).toEqual({
        from: '2026-11-01',
        to: '2026-11-07',
      })
      expect(peticiones[0].body).toBeUndefined()
      expect(programaciones).toEqual([PROGRAMACION])
    })

    it('createSchedule: POST /v2/job-management/schedules con el cuerpo JSON de "Creación válida"', async () => {
      const api = createApiClient(BASE_URL)
      const creada: ScheduleResponse = { ...PROGRAMACION, startTime: '07:00', employeesIds: [] }
      const peticiones = capturar(() => HttpResponse.json(creada, { status: 201 }))

      const resultado = await api.createSchedule({ jobsId: 7, date: '2026-11-02', startTime: '07:00' })

      expect(peticiones).toHaveLength(1)
      expect(peticiones[0].method).toBe('POST')
      expect(peticiones[0].pathname).toBe('/v2/job-management/schedules')
      expect(peticiones[0].contentType).toContain('application/json')
      expect(peticiones[0].body).toEqual({ jobsId: 7, date: '2026-11-02', startTime: '07:00' })
      expect(resultado).toEqual(creada)
    })

    it('createSchedule envía employeesIds cuando vienen', async () => {
      const api = createApiClient(BASE_URL)
      const peticiones = capturar(() => HttpResponse.json(PROGRAMACION, { status: 201 }))

      await api.createSchedule({ jobsId: 7, date: '2026-11-02', startTime: '08:00', employeesIds: [3, 5] })

      expect(peticiones[0].body).toEqual({
        jobsId: 7,
        date: '2026-11-02',
        startTime: '08:00',
        employeesIds: [3, 5],
      })
    })

    it('updateSchedule: PATCH /v2/job-management/schedules/101 con el cuerpo de "Mover a otro día"', async () => {
      const api = createApiClient(BASE_URL)
      const movida: ScheduleResponse = { ...PROGRAMACION, date: '2026-11-04' }
      const peticiones = capturar(() => HttpResponse.json(movida))

      const resultado = await api.updateSchedule(101, { date: '2026-11-04' })

      expect(peticiones).toHaveLength(1)
      expect(peticiones[0].method).toBe('PATCH')
      expect(peticiones[0].pathname).toBe('/v2/job-management/schedules/101')
      expect(peticiones[0].contentType).toContain('application/json')
      expect(peticiones[0].body).toEqual({ date: '2026-11-04' })
      expect(resultado).toEqual(movida)
    })

    it('updateSchedule envía solo startTime cuando solo cambia la hora', async () => {
      const api = createApiClient(BASE_URL)
      const peticiones = capturar(() => HttpResponse.json({ ...PROGRAMACION, startTime: '10:30' }))

      const resultado = await api.updateSchedule(101, { startTime: '10:30' })

      expect(peticiones[0].body).toEqual({ startTime: '10:30' })
      expect(resultado.startTime).toBe('10:30')
    })

    it('createSchedule envía scheduleComment y devuelve el comentario de la respuesta ("Creación con comentario")', async () => {
      const api = createApiClient(BASE_URL)
      const creada: ScheduleResponse = { ...PROGRAMACION, scheduleComment: 'Llevar escalera' }
      const peticiones = capturar(() => HttpResponse.json(creada, { status: 201 }))

      const resultado = await api.createSchedule({
        jobsId: 7,
        date: '2026-11-02',
        startTime: '08:00',
        scheduleComment: 'Llevar escalera',
      })

      expect(peticiones[0].body).toEqual({ jobsId: 7, date: '2026-11-02', startTime: '08:00', scheduleComment: 'Llevar escalera' })
      expect(resultado.scheduleComment).toBe('Llevar escalera')
    })

    it('updateSchedule envía solo scheduleComment ("Cambiar el comentario") y también null para borrarlo', async () => {
      const api = createApiClient(BASE_URL)
      const respuestas = ['Entrar por la puerta trasera', null]
      const peticiones = capturar(() => HttpResponse.json({ ...PROGRAMACION, scheduleComment: respuestas.shift() ?? null }))

      const cambiada = await api.updateSchedule(101, { scheduleComment: 'Entrar por la puerta trasera' })
      const borrada = await api.updateSchedule(101, { scheduleComment: null })

      expect(peticiones.map((peticion) => peticion.body)).toEqual([
        { scheduleComment: 'Entrar por la puerta trasera' },
        { scheduleComment: null },
      ])
      expect(cambiada.scheduleComment).toBe('Entrar por la puerta trasera')
      expect(borrada.scheduleComment).toBeNull()
    })

    it('deleteSchedule: DELETE /v2/job-management/schedules/101 y resuelve undefined con un 204', async () => {
      const api = createApiClient(BASE_URL)
      const peticiones = capturar(() => new HttpResponse(null, { status: 204 }))

      const resultado = await api.deleteSchedule(101)

      expect(peticiones).toHaveLength(1)
      expect(peticiones[0].method).toBe('DELETE')
      expect(peticiones[0].pathname).toBe('/v2/job-management/schedules/101')
      expect(peticiones[0].body).toBeUndefined()
      expect(resultado).toBeUndefined()
    })

    it('replaceScheduleEmployees: PUT /v2/job-management/schedules/101/employees con el cuerpo de "Reemplazo"', async () => {
      const api = createApiClient(BASE_URL)
      const reemplazada: ScheduleResponse = { ...PROGRAMACION, employeesIds: [5, 8] }
      const peticiones = capturar(() => HttpResponse.json(reemplazada))

      const resultado = await api.replaceScheduleEmployees(101, { employeesIds: [5, 8] })

      expect(peticiones).toHaveLength(1)
      expect(peticiones[0].method).toBe('PUT')
      expect(peticiones[0].pathname).toBe('/v2/job-management/schedules/101/employees')
      expect(peticiones[0].contentType).toContain('application/json')
      expect(peticiones[0].body).toEqual({ employeesIds: [5, 8] })
      expect(resultado).toEqual(reemplazada)
    })

    it('replaceScheduleEmployees envía una lista vacía para retirar a todos', async () => {
      const api = createApiClient(BASE_URL)
      const peticiones = capturar(() => HttpResponse.json({ ...PROGRAMACION, employeesIds: [] }))

      const resultado = await api.replaceScheduleEmployees(101, { employeesIds: [] })

      expect(peticiones[0].body).toEqual({ employeesIds: [] })
      expect(resultado.employeesIds).toEqual([])
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

  describe('normalización de startTime "08:00:00" a "08:00"', () => {
    const conSegundos = { ...PROGRAMACION, startTime: '08:00:00' }

    it('en getSchedules', async () => {
      const api = createApiClient(BASE_URL)
      capturar(() => HttpResponse.json([conSegundos]))

      const programaciones = await api.getSchedules({ from: '2026-11-01', to: '2026-11-07' })

      expect(programaciones).toEqual([PROGRAMACION])
    })

    it('en createSchedule', async () => {
      const api = createApiClient(BASE_URL)
      capturar(() => HttpResponse.json(conSegundos, { status: 201 }))

      const creada = await api.createSchedule({ jobsId: 7, date: '2026-11-02', startTime: '08:00' })

      expect(creada).toEqual(PROGRAMACION)
    })

    it('en updateSchedule', async () => {
      const api = createApiClient(BASE_URL)
      capturar(() => HttpResponse.json(conSegundos))

      const actualizada = await api.updateSchedule(101, { startTime: '08:00' })

      expect(actualizada).toEqual(PROGRAMACION)
    })

    it('en replaceScheduleEmployees', async () => {
      const api = createApiClient(BASE_URL)
      capturar(() => HttpResponse.json(conSegundos))

      const reemplazada = await api.replaceScheduleEmployees(101, { employeesIds: [3, 5] })

      expect(reemplazada).toEqual(PROGRAMACION)
    })
  })

  describe('respuesta sin employeesIds ni scheduleComment', () => {
    it('getSchedules los completa con [] y null', async () => {
      const api = createApiClient(BASE_URL)
      const { employeesIds: _ids, scheduleComment: _comentario, ...incompleta } = PROGRAMACION
      capturar(() => HttpResponse.json([incompleta]))

      const programaciones = await api.getSchedules({ from: '2026-11-01', to: '2026-11-07' })

      expect(programaciones).toEqual([{ ...PROGRAMACION, employeesIds: [], scheduleComment: null }])
    })
  })

  describe('errores tipados', () => {
    it('404 con {"error": "No existe"} (PATCH /v2/job-management/schedules/99999) da ApiError not_found', async () => {
      const api = createApiClient(BASE_URL)
      capturar(() => HttpResponse.json({ error: 'No existe' }, { status: 404 }))

      const error = await capturarError(api.updateSchedule(99999, { date: '2026-11-04' }))

      expect(error).toBeInstanceOf(ApiError)
      expect(error).toBeInstanceOf(Error)
      expect(error).toMatchObject({ name: 'ApiError', kind: 'not_found', status: 404, message: 'No existe' })
    })

    it('404 sin cuerpo da el mensaje por defecto "Resource not found"', async () => {
      const api = createApiClient(BASE_URL)
      capturar(() => new HttpResponse(null, { status: 404 }))

      const error = await capturarError(api.deleteSchedule(99999))

      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({ kind: 'not_found', status: 404, message: 'Resource not found' })
    })

    it('422 con {"error": "..."} da ApiError validation con ese mensaje', async () => {
      const api = createApiClient(BASE_URL)
      capturar(() => HttpResponse.json({ error: 'El empleado 9 está inactivo' }, { status: 422 }))

      const error = await capturarError(
        api.createSchedule({ jobsId: 7, date: '2026-11-02', startTime: '08:00', employeesIds: [3, 9] }),
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
    ])('422 %s da el mensaje por defecto "Invalid data"', async (_descripcion, responder) => {
      const api = createApiClient(BASE_URL)
      capturar(responder)

      const error = await capturarError(api.getSchedules({ from: '2026-11-07', to: '2026-11-01' }))

      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({
        kind: 'validation',
        status: 422,
        message: 'Invalid data',
      })
    })

    it('500 sin cuerpo da ApiError http con "Server error (500)"', async () => {
      const api = createApiClient(BASE_URL)
      capturar(() => new HttpResponse(null, { status: 500 }))

      const error = await capturarError(api.replaceScheduleEmployees(101, { employeesIds: [5, 8] }))

      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({ kind: 'http', status: 500, message: 'Server error (500)' })
    })

    it('503 sin cuerpo incluye su código: "Server error (503)"', async () => {
      const api = createApiClient(BASE_URL)
      capturar(() => new HttpResponse(null, { status: 503 }))

      const error = await capturarError(api.getJobs())

      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({ kind: 'http', status: 503, message: 'Server error (503)' })
    })

    it('500 con {"error"} en español muestra ese mensaje tal cual, sin traducirlo', async () => {
      const api = createApiClient(BASE_URL)
      capturar(() => HttpResponse.json({ error: 'La base de datos no responde' }, { status: 500 }))

      const error = await capturarError(api.getEmployees())

      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({ kind: 'http', status: 500, message: 'La base de datos no responde' })
    })

    it.each([
      [
        'con HTML (content-type: text/html), como el index.html de Vite sin backend,',
        () => HttpResponse.html('<!doctype html><html><body><div id="root"></div></body></html>'),
      ],
      ['con texto plano (content-type: text/plain)', () => HttpResponse.text('hola')],
      [
        'sin content-type',
        () => {
          const respuesta = new HttpResponse(new TextEncoder().encode('hola'), { status: 200 })
          respuesta.headers.delete('content-type')
          return respuesta
        },
      ],
    ])('un 200 %s en GET /v1/job da ApiError invalid_response', async (_descripcion, responder) => {
      const api = createApiClient(BASE_URL)
      capturar(responder)

      const error = await capturarError(api.getJobs())

      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({
        name: 'ApiError',
        kind: 'invalid_response',
        status: 200,
        message: 'Unexpected response from the server',
      })
    })

    it('un 201 con HTML en POST /v2/job-management/schedules también da ApiError invalid_response', async () => {
      const api = createApiClient(BASE_URL)
      capturar(() => HttpResponse.html('<html></html>', { status: 201 }))

      const error = await capturarError(api.createSchedule({ jobsId: 7, date: '2026-11-02', startTime: '08:00' }))

      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({
        kind: 'invalid_response',
        status: 201,
        message: 'Unexpected response from the server',
      })
    })

    it('un 200 con content-type "application/json; charset=utf-8" se acepta', async () => {
      const api = createApiClient(BASE_URL)
      capturar(
        () =>
          new HttpResponse(JSON.stringify([TRABAJO]), {
            status: 200,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
          }),
      )

      const trabajos = await api.getJobs()

      expect(trabajos).toEqual([TRABAJO])
    })

    it('un error de red da ApiError network sin status y "Couldn\'t connect to the server"', async () => {
      const api = createApiClient(BASE_URL)
      capturar(() => HttpResponse.error())

      const error = await capturarError(api.getEmployees())

      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({
        kind: 'network',
        status: null,
        message: "Couldn't connect to the server",
      })
    })
  })

  // Las peticiones de este bloque van al mismo origen de jsdom (URL base vacía): así la
  // cabecera `Authorization` no provoca la petición previa `OPTIONS` de CORS.
  describe('autenticación', () => {
    const USUARIO: AuthUser = {
      email: 'demo@hmbrandt.com',
      fullName: 'Demo User',
      id: '1',
      roles: [{ id: 1, name: 'Admin' }],
    }

    /** Sesión con los tokens indicados, en el store y en localStorage, como tras un login. */
    function iniciarSesion(token: string, refreshToken: string) {
      useAuthStore.getState().login(token, refreshToken)
    }

    /** Peticiones recibidas por los manejadores de `simularBackend`. */
    interface Registro {
      /** Cabecera `Authorization` de cada petición a `ruta`, o `null` si no la llevó. */
      autorizaciones: (string | null)[]
      /** Cuerpo y cabecera `Authorization` de cada `POST auth/refresh`. */
      refrescos: { cuerpo: unknown; autorizacion: string | null }[]
    }

    /**
     * Backend simulado: `GET v1/job` responde el catálogo solo si la petición lleva
     * `Bearer <tokenValido>` y 401 en otro caso; `POST auth/refresh` responde lo que
     * devuelva `refrescar` (por defecto, el par de tokens nuevo) tras `retrasoRefresco` ms.
     */
    function simularBackend({
      tokenValido = 't-nuevo',
      refrescar = () =>
        HttpResponse.json({ token: 't-nuevo', refreshToken: 'r-nuevo', userId: '1' }),
      retrasoRefresco = 0,
    }: {
      tokenValido?: string | null
      refrescar?: () => Response
      retrasoRefresco?: number
    } = {}): Registro {
      const registro: Registro = { autorizaciones: [], refrescos: [] }
      server.use(
        http.get('*/v1/job', ({ request }) => {
          const autorizacion = request.headers.get('authorization')
          registro.autorizaciones.push(autorizacion)
          if (tokenValido !== null && autorizacion === `Bearer ${tokenValido}`) {
            return HttpResponse.json([TRABAJO])
          }
          return HttpResponse.json({ error: 'Token expired' }, { status: 401 })
        }),
        http.post('*/auth/refresh', async ({ request }) => {
          registro.refrescos.push({
            cuerpo: await request.json(),
            autorizacion: request.headers.get('authorization'),
          })
          if (retrasoRefresco > 0) await delay(retrasoRefresco)
          return refrescar()
        }),
      )
      return registro
    }

    let assign: ReturnType<typeof simularNavegacion>

    beforeEach(() => {
      assign = simularNavegacion()
    })

    afterEach(() => {
      useAuthStore.setState({ token: null, refreshToken: null, isAuthenticated: false, user: null })
      localStorage.clear()
      vi.unstubAllGlobals()
    })

    /** Comprueba que se cerró la sesión y se navegó al login. */
    function esperarIrAlLogin() {
      expect(assign).toHaveBeenCalledTimes(1)
      expect(assign).toHaveBeenCalledWith(LOGIN_URL)
      expect(useAuthStore.getState()).toMatchObject({ token: null, refreshToken: null, isAuthenticated: false })
      expect(localStorage.getItem('auth_token')).toBeNull()
      expect(localStorage.getItem('refresh_token')).toBeNull()
    }

    describe('cabecera Authorization', () => {
      it('con token en el store envía "Authorization: Bearer <token>"', async () => {
        iniciarSesion('t-nuevo', 'r-nuevo')
        const registro = simularBackend()
        const api = createApiClient('')

        const trabajos = await api.getJobs()

        expect(trabajos).toEqual([TRABAJO])
        expect(registro.autorizaciones).toEqual(['Bearer t-nuevo'])
      })

      it('sin token no envía la cabecera Authorization', async () => {
        const autorizaciones: (string | null)[] = []
        server.use(
          http.get('*/v1/employee', ({ request }) => {
            autorizaciones.push(request.headers.get('authorization'))
            return HttpResponse.json(EMPLEADOS)
          }),
        )
        const api = createApiClient('')

        await api.getEmployees()

        expect(autorizaciones).toEqual([null])
      })

      it('lee el token del store en cada petición, no al crear el cliente', async () => {
        const api = createApiClient('')
        iniciarSesion('t-nuevo', 'r-nuevo')
        const registro = simularBackend()

        await api.getJobs()

        expect(registro.autorizaciones).toEqual(['Bearer t-nuevo'])
      })

      it('envía la cabecera también en POST, PATCH, PUT y DELETE', async () => {
        iniciarSesion('t-nuevo', 'r-nuevo')
        const autorizaciones: string[] = []
        server.use(
          http.all('*/v2/job-management/schedules*', ({ request }) => {
            autorizaciones.push(`${request.method} ${request.headers.get('authorization')}`)
            if (request.method === 'DELETE') return new HttpResponse(null, { status: 204 })
            return HttpResponse.json(PROGRAMACION)
          }),
        )
        const api = createApiClient('')

        await api.createSchedule({ jobsId: 7, date: '2026-11-02', startTime: '08:00' })
        await api.updateSchedule(101, { date: '2026-11-04' })
        await api.replaceScheduleEmployees(101, { employeesIds: [5] })
        await api.deleteSchedule(101)

        expect(autorizaciones).toEqual([
          'POST Bearer t-nuevo',
          'PATCH Bearer t-nuevo',
          'PUT Bearer t-nuevo',
          'DELETE Bearer t-nuevo',
        ])
      })
    })

    describe('getMe', () => {
      it('pide GET auth/me, sin v1/, y devuelve el usuario', async () => {
        iniciarSesion('t-nuevo', 'r-nuevo')
        const peticiones: { ruta: string; autorizacion: string | null }[] = []
        server.use(
          http.get('*', ({ request }) => {
            peticiones.push({ ruta: new URL(request.url).pathname, autorizacion: request.headers.get('authorization') })
            return HttpResponse.json(USUARIO)
          }),
        )
        const api = createApiClient('')

        const usuario = await api.getMe()

        expect(usuario).toEqual(USUARIO)
        expect(peticiones).toEqual([{ ruta: '/auth/me', autorizacion: 'Bearer t-nuevo' }])
      })

      it('con una URL base con prefijo /api pide https://host/api/auth/me', async () => {
        const api = createApiClient('https://host/api')
        const peticiones = capturarUrls()

        await api.getMe()

        expect(peticiones).toEqual([{ method: 'GET', url: 'https://host/api/auth/me' }])
      })
    })

    describe('refresco del token ante un 401', () => {
      it('pide POST auth/refresh con el refreshToken, guarda los tokens nuevos y reintenta la petición', async () => {
        iniciarSesion('t-viejo', 'r-viejo')
        const registro = simularBackend()
        const api = createApiClient('')

        const trabajos = await api.getJobs()

        expect(trabajos).toEqual([TRABAJO])
        expect(registro.refrescos).toEqual([{ cuerpo: { refreshToken: 'r-viejo' }, autorizacion: null }])
        expect(registro.autorizaciones).toEqual(['Bearer t-viejo', 'Bearer t-nuevo'])
        expect(useAuthStore.getState()).toMatchObject({
          token: 't-nuevo',
          refreshToken: 'r-nuevo',
          isAuthenticated: true,
        })
        expect(localStorage.getItem('auth_token')).toBe('t-nuevo')
        expect(localStorage.getItem('refresh_token')).toBe('r-nuevo')
        expect(assign).not.toHaveBeenCalled()
      })

      it('el reintento conserva el método, la ruta, los parámetros y el cuerpo de la petición original', async () => {
        iniciarSesion('t-viejo', 'r-viejo')
        const peticiones: { autorizacion: string | null; metodo: string; ruta: string; cuerpo: unknown }[] = []
        server.use(
          http.patch('*/v2/job-management/schedules/:id', async ({ request }) => {
            const autorizacion = request.headers.get('authorization')
            peticiones.push({
              autorizacion,
              metodo: request.method,
              ruta: new URL(request.url).pathname,
              cuerpo: await request.json(),
            })
            if (autorizacion !== 'Bearer t-nuevo') return new HttpResponse(null, { status: 401 })
            return HttpResponse.json({ ...PROGRAMACION, date: '2026-11-04' })
          }),
          http.post('*/auth/refresh', () =>
            HttpResponse.json({ token: 't-nuevo', refreshToken: 'r-nuevo', userId: '1' }),
          ),
        )
        const api = createApiClient('')

        const movida = await api.updateSchedule(101, { date: '2026-11-04' })

        expect(movida.date).toBe('2026-11-04')
        expect(peticiones).toEqual([
          { autorizacion: 'Bearer t-viejo', metodo: 'PATCH', ruta: '/v2/job-management/schedules/101', cuerpo: { date: '2026-11-04' } },
          { autorizacion: 'Bearer t-nuevo', metodo: 'PATCH', ruta: '/v2/job-management/schedules/101', cuerpo: { date: '2026-11-04' } },
        ])
      })

      it('varios 401 simultáneos comparten una sola petición de refresco', async () => {
        iniciarSesion('t-viejo', 'r-viejo')
        const registro = simularBackend({ retrasoRefresco: 50 })
        const autorizacionesEmpleados: (string | null)[] = []
        server.use(
          http.get('*/v1/employee', ({ request }) => {
            const autorizacion = request.headers.get('authorization')
            autorizacionesEmpleados.push(autorizacion)
            if (autorizacion !== 'Bearer t-nuevo') return new HttpResponse(null, { status: 401 })
            return HttpResponse.json(EMPLEADOS)
          }),
        )
        const api = createApiClient('')

        const [trabajos, empleados, otrosTrabajos] = await Promise.all([
          api.getJobs(),
          api.getEmployees(),
          api.getJobs(),
        ])

        expect(registro.refrescos).toHaveLength(1)
        expect(trabajos).toEqual([TRABAJO])
        expect(otrosTrabajos).toEqual([TRABAJO])
        expect(empleados).toEqual(EMPLEADOS)
        expect(autorizacionesEmpleados).toEqual(['Bearer t-viejo', 'Bearer t-nuevo'])
        expect(assign).not.toHaveBeenCalled()
      })

      it('un 401 posterior a un refresco ya terminado pide un refresco nuevo', async () => {
        iniciarSesion('t-viejo', 'r-viejo')
        const registro = simularBackend()
        const api = createApiClient('')
        await api.getJobs()

        // El token nuevo también caduca: el servidor vuelve a aceptar solo el siguiente.
        server.use(
          http.get('*/v1/job', ({ request }) =>
            request.headers.get('authorization') === 'Bearer t-tercero'
              ? HttpResponse.json([TRABAJO])
              : new HttpResponse(null, { status: 401 }),
          ),
          http.post('*/auth/refresh', async ({ request }) => {
            registro.refrescos.push({ cuerpo: await request.json(), autorizacion: null })
            return HttpResponse.json({ token: 't-tercero', refreshToken: 'r-tercero', userId: '1' })
          }),
        )
        const trabajos = await api.getJobs()

        expect(trabajos).toEqual([TRABAJO])
        expect(registro.refrescos.map((refresco) => refresco.cuerpo)).toEqual([
          { refreshToken: 'r-viejo' },
          { refreshToken: 'r-nuevo' },
        ])
        expect(useAuthStore.getState().token).toBe('t-tercero')
        expect(assign).not.toHaveBeenCalled()
      })
    })

    describe('sesión perdida: va al login y rechaza con ApiError', () => {
      it('sin refreshToken no intenta refrescar', async () => {
        useAuthStore.setState({ token: 't-viejo', refreshToken: null, isAuthenticated: true })
        localStorage.setItem('auth_token', 't-viejo')
        const registro = simularBackend()
        const api = createApiClient('')

        const error = await capturarError(api.getJobs())

        expect(error).toBeInstanceOf(ApiError)
        expect(error).toMatchObject({ kind: 'http', status: 401, message: 'Token expired' })
        expect(registro.refrescos).toHaveLength(0)
        expect(registro.autorizaciones).toEqual(['Bearer t-viejo'])
        esperarIrAlLogin()
      })

      it('sin ninguna sesión, un 401 también va al login', async () => {
        const registro = simularBackend()
        const api = createApiClient('')

        const error = await capturarError(api.getJobs())

        expect(error).toBeInstanceOf(ApiError)
        expect(error).toMatchObject({ status: 401 })
        expect(registro.autorizaciones).toEqual([null])
        expect(registro.refrescos).toHaveLength(0)
        esperarIrAlLogin()
      })

      it.each([
        ['responde 401', () => HttpResponse.json({ error: 'Refresh token expired' }, { status: 401 })],
        ['responde 500', () => new HttpResponse(null, { status: 500 })],
        ['falla por red', () => HttpResponse.error()],
      ])('si el refresco %s, no reintenta la petición', async (_descripcion, refrescar) => {
        iniciarSesion('t-viejo', 'r-viejo')
        const registro = simularBackend({ refrescar })
        const api = createApiClient('')

        const error = await capturarError(api.getJobs())

        expect(error).toBeInstanceOf(ApiError)
        expect(error).toMatchObject({ kind: 'http', status: 401, message: 'Token expired' })
        expect(registro.refrescos).toHaveLength(1)
        expect(registro.autorizaciones).toEqual(['Bearer t-viejo'])
        esperarIrAlLogin()
      })

      it('si el reintento vuelve a dar 401, no refresca otra vez', async () => {
        iniciarSesion('t-viejo', 'r-viejo')
        const registro = simularBackend({ tokenValido: null })
        const api = createApiClient('')

        const error = await capturarError(api.getJobs())

        expect(error).toBeInstanceOf(ApiError)
        expect(error).toMatchObject({ kind: 'http', status: 401 })
        expect(registro.refrescos).toHaveLength(1)
        expect(registro.autorizaciones).toEqual(['Bearer t-viejo', 'Bearer t-nuevo'])
        esperarIrAlLogin()
      })

      it('si varios 401 simultáneos comparten un refresco fallido, todas las peticiones fallan con ApiError', async () => {
        iniciarSesion('t-viejo', 'r-viejo')
        const registro = simularBackend({
          refrescar: () => new HttpResponse(null, { status: 401 }),
          retrasoRefresco: 50,
        })
        const api = createApiClient('')

        const errores = await Promise.all([
          capturarError(api.getJobs()),
          capturarError(api.getJobs()),
        ])

        expect(registro.refrescos).toHaveLength(1)
        for (const error of errores) {
          expect(error).toBeInstanceOf(ApiError)
          expect(error).toMatchObject({ status: 401 })
        }
        expect(assign).toHaveBeenCalledWith(LOGIN_URL)
        expect(useAuthStore.getState().token).toBeNull()
      })
    })

    describe('otros errores no tocan la sesión', () => {
      it.each([403, 404, 500])('un %i no refresca ni va al login', async (status) => {
        iniciarSesion('t-nuevo', 'r-nuevo')
        const registro = simularBackend()
        server.use(http.get('*/v1/job', () => new HttpResponse(null, { status })))
        const api = createApiClient('')

        const error = await capturarError(api.getJobs())

        expect(error).toBeInstanceOf(ApiError)
        expect(error).toMatchObject({ status })
        expect(registro.refrescos).toHaveLength(0)
        expect(assign).not.toHaveBeenCalled()
        expect(useAuthStore.getState().token).toBe('t-nuevo')
      })

      it('un error de red no refresca ni va al login', async () => {
        iniciarSesion('t-nuevo', 'r-nuevo')
        const registro = simularBackend()
        server.use(http.get('*/v1/job', () => HttpResponse.error()))
        const api = createApiClient('')

        const error = await capturarError(api.getJobs())

        expect(error).toMatchObject({ kind: 'network' })
        expect(registro.refrescos).toHaveLength(0)
        expect(assign).not.toHaveBeenCalled()
      })
    })
  })
})
