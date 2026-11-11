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
import { readConfig } from '../config'
import { ApiError, createApiClient } from './client'
import type { Employee, Job, Schedule } from './types'
import { empleado, trabajo } from '../test/fabricas'

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
const TRABAJO: Job = trabajo(7, 'J-1024', 'Pintar oficina')

const PROGRAMACION: Schedule = {
  jobSchedulesId: 101,
  job: TRABAJO,
  date: '2026-11-02',
  startTime: '08:00',
  employeesIds: [3, 5],
  scheduleComment: null,
}

const EMPLEADOS: Employee[] = [
  empleado(3, 'Ana', 'López', 'Pintora'),
  empleado(5, 'Luis', 'Martínez', 'Electricista'),
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
  describe('rutas v1/... relativas a la URL base (tarea 11.7)', () => {
    it('escenario "URL base vacía": las siete peticiones van a /v1/... del mismo origen de la página', async () => {
      const api = createApiClient('')
      const peticiones = capturarUrls()

      await llamarLosSieteEndpoints(api)

      const origen = window.location.origin
      expect(peticiones).toEqual([
        { method: 'GET', url: `${origen}/v1/employee` },
        { method: 'GET', url: `${origen}/v1/job` },
        { method: 'GET', url: `${origen}/v1/schedules` },
        { method: 'POST', url: `${origen}/v1/schedules` },
        { method: 'PATCH', url: `${origen}/v1/schedules/101` },
        { method: 'DELETE', url: `${origen}/v1/schedules/101` },
        { method: 'PUT', url: `${origen}/v1/schedules/101/employees` },
      ])
    })

    it('con una URL absoluta con prefijo /api las siete peticiones van a https://host/api/v1/..., sin /api/api', async () => {
      const api = createApiClient('https://host/api')
      const peticiones = capturarUrls()

      await llamarLosSieteEndpoints(api)

      expect(peticiones).toEqual([
        { method: 'GET', url: 'https://host/api/v1/employee' },
        { method: 'GET', url: 'https://host/api/v1/job' },
        { method: 'GET', url: 'https://host/api/v1/schedules' },
        { method: 'POST', url: 'https://host/api/v1/schedules' },
        { method: 'PATCH', url: 'https://host/api/v1/schedules/101' },
        { method: 'DELETE', url: 'https://host/api/v1/schedules/101' },
        { method: 'PUT', url: 'https://host/api/v1/schedules/101/employees' },
      ])
      for (const { url } of peticiones) {
        expect(url).not.toContain('/api/api')
        expect(url).not.toContain('//v1')
      }
    })

    it('escenario "URL base con prefijo": VITE_API_URL "https://api.ejemplo.com/api/" pide la 101 en .../api/v1/schedules/101', async () => {
      const api = createApiClient(readConfig({ VITE_API_URL: 'https://api.ejemplo.com/api/' }).apiUrl)
      const peticiones = capturarUrls()

      await api.updateSchedule(101, { date: '2026-11-04' })

      expect(peticiones).toEqual([{ method: 'PATCH', url: 'https://api.ejemplo.com/api/v1/schedules/101' }])
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

    it('getJobs con search: envía ?search=pintar', async () => {
      const api = createApiClient(BASE_URL)
      const peticiones = capturar(() => HttpResponse.json([TRABAJO]))

      const trabajos = await api.getJobs({ search: 'pintar' })

      expect(peticiones[0].method).toBe('GET')
      expect(peticiones[0].pathname).toBe('/v1/job')
      expect([...peticiones[0].searchParams]).toEqual([['search', 'pintar']])
      expect(trabajos).toEqual([TRABAJO])
    })

    it('getSchedules: GET /v1/schedules con from y to', async () => {
      const api = createApiClient(BASE_URL)
      const peticiones = capturar(() => HttpResponse.json([PROGRAMACION]))

      const programaciones = await api.getSchedules({ from: '2026-11-01', to: '2026-11-07' })

      expect(peticiones).toHaveLength(1)
      expect(peticiones[0].method).toBe('GET')
      expect(peticiones[0].pathname).toBe('/v1/schedules')
      expect(Object.fromEntries(peticiones[0].searchParams)).toEqual({
        from: '2026-11-01',
        to: '2026-11-07',
      })
      expect(peticiones[0].body).toBeUndefined()
      expect(programaciones).toEqual([PROGRAMACION])
    })

    it('createSchedule: POST /v1/schedules con el cuerpo JSON de "Creación válida"', async () => {
      const api = createApiClient(BASE_URL)
      const creada: Schedule = { ...PROGRAMACION, startTime: '07:00', employeesIds: [] }
      const peticiones = capturar(() => HttpResponse.json(creada, { status: 201 }))

      const resultado = await api.createSchedule({ jobsId: 7, date: '2026-11-02', startTime: '07:00' })

      expect(peticiones).toHaveLength(1)
      expect(peticiones[0].method).toBe('POST')
      expect(peticiones[0].pathname).toBe('/v1/schedules')
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

    it('updateSchedule: PATCH /v1/schedules/101 con el cuerpo de "Mover a otro día"', async () => {
      const api = createApiClient(BASE_URL)
      const movida: Schedule = { ...PROGRAMACION, date: '2026-11-04' }
      const peticiones = capturar(() => HttpResponse.json(movida))

      const resultado = await api.updateSchedule(101, { date: '2026-11-04' })

      expect(peticiones).toHaveLength(1)
      expect(peticiones[0].method).toBe('PATCH')
      expect(peticiones[0].pathname).toBe('/v1/schedules/101')
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
      const creada: Schedule = { ...PROGRAMACION, scheduleComment: 'Llevar escalera' }
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

    it('deleteSchedule: DELETE /v1/schedules/101 y resuelve undefined con un 204', async () => {
      const api = createApiClient(BASE_URL)
      const peticiones = capturar(() => new HttpResponse(null, { status: 204 }))

      const resultado = await api.deleteSchedule(101)

      expect(peticiones).toHaveLength(1)
      expect(peticiones[0].method).toBe('DELETE')
      expect(peticiones[0].pathname).toBe('/v1/schedules/101')
      expect(peticiones[0].body).toBeUndefined()
      expect(resultado).toBeUndefined()
    })

    it('replaceScheduleEmployees: PUT /v1/schedules/101/employees con el cuerpo de "Reemplazo"', async () => {
      const api = createApiClient(BASE_URL)
      const reemplazada: Schedule = { ...PROGRAMACION, employeesIds: [5, 8] }
      const peticiones = capturar(() => HttpResponse.json(reemplazada))

      const resultado = await api.replaceScheduleEmployees(101, { employeesIds: [5, 8] })

      expect(peticiones).toHaveLength(1)
      expect(peticiones[0].method).toBe('PUT')
      expect(peticiones[0].pathname).toBe('/v1/schedules/101/employees')
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

  describe('errores tipados', () => {
    it('404 con {"error": "No existe"} (PATCH /v1/schedules/99999) da ApiError not_found', async () => {
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

    it('un 201 con HTML en POST /v1/schedules también da ApiError invalid_response', async () => {
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
})
