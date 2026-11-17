// Tests de los manejadores MSW (tareas 3.2 y 3.3 de `schedule-assign`) con `msw/node`.
//
// Cada test parte de un estado limpio: `beforeEach` sustituye los manejadores por
// unos nuevos creados con `createHandlers(createSeed(HOY))`, que tienen su propia
// base en memoria.
//
// Los manejadores usan un comodín de origen (`*/v1/...`). Casi todas las peticiones se
// hacen con `fetch` al mismo origen de jsdom (`http://localhost:3000`), así que no hay
// CORS de por medio; un bloque aparte comprueba que también interceptan otro origen con
// prefijo `/api`.
//
// Caso límite 1 de `docs/api.md`: el orden de `employeesIds` no está garantizado, por
// eso los tests los comparan ordenados.
import { setupServer } from 'msw/node'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Employee, Job, Schedule } from '../api/types'
import { createApiClient } from '../api/client'
import { empleado, trabajo } from '../test/fabricas'
import { createHandlers } from './handlers'
import { createSeed } from './seed'

/** Martes 2026-11-03: la semilla arma la semana del 2026-11-01 al 2026-11-07. */
const HOY = new Date(2026, 10, 3)

const TRABAJO_7: Job = trabajo(7, 'J-1024', 'Pintar oficina')

/** Programación 101 de los escenarios del spec. */
const PROGRAMACION_101: Schedule = {
  jobSchedulesId: 101,
  job: TRABAJO_7,
  date: '2026-11-02',
  startTime: '08:00',
  employeesIds: [3, 5],
  scheduleComment: null,
}

const server = setupServer()

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
})

beforeEach(() => {
  server.resetHandlers(...createHandlers(createSeed(HOY)))
})

afterAll(() => {
  server.close()
})

type Semilla = ReturnType<typeof createSeed>

/** Sustituye los manejadores por unos creados con la semilla de `HOY` modificada. */
function usarSemilla(modificar: (semilla: Semilla) => void) {
  const semilla = createSeed(HOY)
  modificar(semilla)
  server.resetHandlers(...createHandlers(semilla))
}

/** Añade a la semilla la programación 101 del spec, con los empleados indicados. */
function conProgramacion101(employeeIds: number[] = [3, 5]) {
  usarSemilla((semilla) => {
    semilla.schedules.push({ ...PROGRAMACION_101, employeesIds: employeeIds })
  })
}

interface Respuesta {
  status: number
  /** Texto del cuerpo, tal cual. */
  texto: string
  /** Cuerpo JSON interpretado, o `undefined` si vino vacío. */
  // oxlint-disable-next-line typescript/no-explicit-any
  cuerpo: any
}

/**
 * Hace una petición al mismo origen de jsdom. `cuerpo` se envía como JSON, salvo que
 * sea `{ crudo }`, que se envía tal cual (para probar cuerpos mal formados).
 */
async function pedir(
  metodo: string,
  ruta: string,
  cuerpo?: unknown,
): Promise<Respuesta> {
  const init: RequestInit = { method: metodo }
  if (cuerpo !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body =
      typeof cuerpo === 'object' && cuerpo !== null && 'crudo' in cuerpo
        ? String((cuerpo as { crudo: unknown }).crudo)
        : JSON.stringify(cuerpo)
  }
  const respuesta = await fetch(new URL(ruta, location.href), init)
  const texto = await respuesta.text()
  return { status: respuesta.status, texto, cuerpo: texto === '' ? undefined : JSON.parse(texto) }
}

/** Programaciones de la semana de `HOY`. */
async function semana(): Promise<Schedule[]> {
  const respuesta = await pedir('GET', '/v1/schedules?from=2026-11-01&to=2026-11-07')
  expect(respuesta.status).toBe(200)
  return respuesta.cuerpo
}

async function buscarProgramacion(id: number): Promise<Schedule | undefined> {
  return (await semana()).find((programacion) => programacion.jobSchedulesId === id)
}

const ordenados = (ids: number[]) => [...ids].sort((a, b) => a - b)

/** Comprueba un error 4xx con el cuerpo `{"error": mensaje}` exacto. */
function esperarError(respuesta: Respuesta, status: number, mensaje: string) {
  expect(respuesta.status).toBe(status)
  expect(respuesta.cuerpo).toEqual({ error: mensaje })
}

describe('GET /v1/employee', () => {
  it('Todos: 200 con empleados activos e inactivos', async () => {
    const respuesta = await pedir('GET', '/v1/employee')

    expect(respuesta.status).toBe(200)
    const empleados: Employee[] = respuesta.cuerpo
    expect(empleados).toHaveLength(10)
    expect(empleados.some((empleado) => empleado.status === 'Active')).toBe(true)
    expect(empleados.some((empleado) => empleado.status === 'Terminated')).toBe(true)
  })

  it('cada empleado tiene la forma {employeesId, legalName, employeeNumber, firstName, lastName, status, title, user}', async () => {
    const { cuerpo } = await pedir('GET', '/v1/employee')

    expect(cuerpo).toContainEqual(empleado(3, 'Ana', 'López', 'Pintora'))
    for (const empleado of cuerpo as Employee[]) {
      expect(Object.keys(empleado).sort()).toEqual(
        ['employeesId', 'legalName', 'employeeNumber', 'firstName', 'lastName', 'status', 'title', 'user'].sort(),
      )
    }
  })

  it('Solo activos: ?status=Active devuelve solo los activos', async () => {
    const respuesta = await pedir('GET', '/v1/employee?status=Active')

    expect(respuesta.status).toBe(200)
    const empleados: Employee[] = respuesta.cuerpo
    expect(empleados).toHaveLength(8)
    expect(empleados.every((empleado) => empleado.status === 'Active')).toBe(true)
  })

  it('?status=Terminated devuelve solo los inactivos', async () => {
    const respuesta = await pedir('GET', '/v1/employee?status=Terminated')

    expect(respuesta.status).toBe(200)
    expect((respuesta.cuerpo as Employee[]).map((empleado) => empleado.employeesId)).toEqual([10, 9])
  })

  it('ordena por firstName', async () => {
    const { cuerpo } = await pedir('GET', '/v1/employee')

    expect(
      (cuerpo as Employee[]).map((empleado) => `${empleado.firstName} ${empleado.lastName}`),
    ).toEqual([
      'Ana López',
      'Carlos Ruiz',
      'Elena Díaz',
      'Jorge Pérez',
      'Lucía Navarro',
      'Luis Martínez',
      'Marta Gómez',
      'Pedro Sánchez',
      'Raúl Torres',
      'Sofía Romero',
    ])
  })

  it('con el mismo firstName desempata por lastName', async () => {
    usarSemilla((semilla) => {
      semilla.employees.push(
        empleado(12, 'Ana', 'Zapata'),
        empleado(11, 'Ana', 'Abad'),
      )
    })

    const { cuerpo } = await pedir('GET', '/v1/employee?status=Active')

    expect((cuerpo as Employee[]).slice(0, 3).map((empleado) => empleado.employeesId)).toEqual([11, 3, 12])
  })

  it('ordena por firstName y lastName también al filtrar por Terminated', async () => {
    usarSemilla((semilla) => {
      semilla.employees.push(
        empleado(12, 'Lucía', 'Abad', 'Ayudante', 'Terminated'),
        empleado(11, 'Ana', 'Zapata', 'Ayudante', 'Terminated'),
      )
    })

    const { cuerpo } = await pedir('GET', '/v1/employee?status=Terminated')

    expect(
      (cuerpo as Employee[]).map((empleado) => `${empleado.firstName} ${empleado.lastName}`),
    ).toEqual(['Ana Zapata', 'Lucía Abad', 'Lucía Navarro', 'Raúl Torres'])
  })

  it('caso límite 6: ?status=otro da 422 con el mensaje exacto', async () => {
    esperarError(await pedir('GET', '/v1/employee?status=otro'), 422, 'El estado "otro" no es válido')
  })

  it.each([['activo'], ['inactivo'], ['active'], ['TERMINATED']])(
    'los valores viejos o con otras mayúsculas (?status=%s) dan 422',
    async (estado) => {
      esperarError(await pedir('GET', `/v1/employee?status=${estado}`), 422, `El estado "${estado}" no es válido`)
    },
  )
})

describe('GET /v1/job', () => {
  it('sin search devuelve todo el catálogo con la forma {jobsId, number, type, name, address, contractor, contact, status, user}', async () => {
    const respuesta = await pedir('GET', '/v1/job')

    expect(respuesta.status).toBe(200)
    expect(respuesta.cuerpo).toHaveLength(30)
    expect(respuesta.cuerpo).toContainEqual(TRABAJO_7)
    for (const trabajo of respuesta.cuerpo as Job[]) {
      expect(Object.keys(trabajo).sort()).toEqual(
        ['jobsId', 'number', 'type', 'name', 'address', 'contractor', 'contact', 'status', 'user'].sort(),
      )
    }
  })

  it('Trabajos terminados incluidos: devuelve el trabajo con status "Done"', async () => {
    const { cuerpo } = await pedir('GET', '/v1/job')

    const terminados = (cuerpo as Job[]).filter((trabajo) => trabajo.status === 'Done')
    expect(terminados).toEqual([trabajo(30, 'J-1047', 'Revisar ascensor', 'Done')])
  })

  it('la búsqueda tampoco filtra por status: ?search=ascensor devuelve el trabajo "Done"', async () => {
    const { cuerpo } = await pedir('GET', '/v1/job?search=ascensor')

    expect(cuerpo).toEqual([trabajo(30, 'J-1047', 'Revisar ascensor', 'Done')])
  })

  it('ordena por number aunque el catálogo venga desordenado', async () => {
    usarSemilla((semilla) => {
      semilla.jobs.reverse()
    })

    const { cuerpo } = await pedir('GET', '/v1/job')
    const numeros = (cuerpo as Job[]).map((trabajo) => trabajo.number)

    expect(numeros[0]).toBe('J-1018')
    expect(numeros.at(-1)).toBe('J-1047')
    expect(numeros).toEqual([...numeros].sort())
  })

  it('Búsqueda por nombre: ?search=pintar incluye "Pintar oficina"', async () => {
    const respuesta = await pedir('GET', '/v1/job?search=pintar')

    expect(respuesta.status).toBe(200)
    const trabajos: Job[] = respuesta.cuerpo
    expect(trabajos).toContainEqual(TRABAJO_7)
    expect(trabajos.map((trabajo) => trabajo.name)).toEqual(['Pintar oficina', 'Pintar pasillo'])
    expect(trabajos.map((trabajo) => trabajo.number)).toEqual(['J-1024', 'J-1039'])
  })

  it.each([['PINTAR'], ['Pintar'], ['pInTaR']])(
    'la búsqueda no distingue mayúsculas (%s)',
    async (texto) => {
      const { cuerpo } = await pedir('GET', `/v1/job?search=${texto}`)

      expect((cuerpo as Job[]).map((trabajo) => trabajo.jobsId)).toEqual([7, 22])
    },
  )

  it('busca también por number, sin distinguir mayúsculas', async () => {
    const { cuerpo } = await pedir('GET', '/v1/job?search=j-1024')

    expect(cuerpo).toEqual([TRABAJO_7])
  })

  it('busca texto en medio del nombre', async () => {
    const { cuerpo } = await pedir('GET', `/v1/job?search=${encodeURIComponent('r OFIC')}`)

    expect(cuerpo).toEqual([TRABAJO_7])
  })

  it('sin coincidencias devuelve 200 con lista vacía', async () => {
    const respuesta = await pedir('GET', '/v1/job?search=zzz')

    expect(respuesta.status).toBe(200)
    expect(respuesta.cuerpo).toEqual([])
  })

  it('search vacío devuelve todo el catálogo', async () => {
    const { cuerpo } = await pedir('GET', '/v1/job?search=')

    expect(cuerpo).toHaveLength(30)
  })
})

describe('GET /v1/schedules', () => {
  it('Programación con dos empleados: la representación es la del spec', async () => {
    usarSemilla((semilla) => {
      semilla.schedules = [PROGRAMACION_101]
    })

    const respuesta = await pedir('GET', '/v1/schedules?from=2026-11-01&to=2026-11-07')

    expect(respuesta.status).toBe(200)
    expect(respuesta.cuerpo).toHaveLength(1)
    expect(respuesta.cuerpo[0]).toMatchObject({
      jobSchedulesId: 101,
      job: {
        jobsId: 7,
        number: 'J-1024',
        type: 'Interior',
        name: 'Pintar oficina',
        address: expect.any(String),
        contractor: expect.any(String),
        contact: expect.any(String),
        status: 'Open',
        user: expect.any(String),
      },
      date: '2026-11-02',
      startTime: '08:00',
      employeesIds: [3, 5],
      scheduleComment: null,
    })
  })

  it('devuelve las programaciones de la semilla con la forma del contrato y el job igual al de GET v1/job', async () => {
    const programaciones = await semana()
    const { cuerpo: trabajos } = await pedir('GET', '/v1/job')

    expect(programaciones).toHaveLength(4)
    for (const programacion of programaciones) {
      expect(Object.keys(programacion)).toEqual(
        expect.arrayContaining(['date', 'employeesIds', 'jobSchedulesId', 'job', 'startTime', 'scheduleComment']),
      )
      expect(Object.keys(programacion)).not.toEqual(expect.arrayContaining(['id']))
      expect(trabajos).toContainEqual(programacion.job)
      expect(programacion.startTime).toMatch(/^\d{2}:\d{2}$/)
    }
  })

  it('Semana completa: incluye las del día 7 y excluye las de fuera del rango', async () => {
    const sabado = await pedir('POST', '/v1/schedules', { jobsId: 1, date: '2026-11-07', startTime: '09:00' })
    const antes = await pedir('POST', '/v1/schedules', { jobsId: 2, date: '2026-10-31', startTime: '09:00' })
    const despues = await pedir('POST', '/v1/schedules', { jobsId: 3, date: '2026-11-08', startTime: '09:00' })

    const respuesta = await pedir('GET', '/v1/schedules?from=2026-11-01&to=2026-11-07')

    expect(respuesta.status).toBe(200)
    const ids = (respuesta.cuerpo as Schedule[]).map((programacion) => programacion.jobSchedulesId)
    expect(ids).toContain(sabado.cuerpo.jobSchedulesId)
    expect(ids).not.toContain(antes.cuerpo.jobSchedulesId)
    expect(ids).not.toContain(despues.cuerpo.jobSchedulesId)
    expect(ids).toHaveLength(5)
  })

  it('from igual a to devuelve solo ese día', async () => {
    const respuesta = await pedir('GET', '/v1/schedules?from=2026-11-02&to=2026-11-02')

    expect(respuesta.status).toBe(200)
    expect((respuesta.cuerpo as Schedule[]).every((programacion) => programacion.date === '2026-11-02')).toBe(true)
    expect(respuesta.cuerpo).toHaveLength(2)
  })

  it('ordena por fecha, hora de inicio e id', async () => {
    // La semilla tiene 1 (02, 07:00), 2 (02, 08:00), 3 (03, 07:00) y 4 (05, 09:30).
    const temprana = await pedir('POST', '/v1/schedules', { jobsId: 1, date: '2026-11-02', startTime: '06:00' })
    const empate = await pedir('POST', '/v1/schedules', { jobsId: 2, date: '2026-11-02', startTime: '07:00' })
    const domingo = await pedir('POST', '/v1/schedules', { jobsId: 3, date: '2026-11-01', startTime: '23:00' })

    const ids = (await semana()).map((programacion) => programacion.jobSchedulesId)

    expect(ids).toEqual([domingo.cuerpo.jobSchedulesId, temprana.cuerpo.jobSchedulesId, 1, empate.cuerpo.jobSchedulesId, 2, 3, 4])
  })

  it('Rango invertido: 422 con el mensaje exacto', async () => {
    esperarError(
      await pedir('GET', '/v1/schedules?from=2026-11-07&to=2026-11-01'),
      422,
      'La fecha from no puede ser posterior a to',
    )
  })

  it.each([
    ['falta from', '?to=2026-11-07'],
    ['falta to', '?from=2026-11-01'],
    ['faltan los dos', ''],
    ['from no es una fecha', '?from=hoy&to=2026-11-07'],
    ['to con mes 13', '?from=2026-11-01&to=2026-13-01'],
    ['to con un día que no existe', '?from=2026-02-01&to=2026-02-30'],
    ['from con hora', '?from=2026-11-01T00:00&to=2026-11-07'],
  ])('422 cuando %s', async (_descripcion, query) => {
    esperarError(
      await pedir('GET', `/v1/schedules${query}`),
      422,
      'Los parámetros from y to deben ser fechas AAAA-MM-DD',
    )
  })
})

describe('POST /v1/schedules', () => {
  it('Creación válida: 201 con la nueva programación y employeesIds vacío', async () => {
    const respuesta = await pedir('POST', '/v1/schedules', {
      jobsId: 7,
      date: '2026-11-02',
      startTime: '07:00',
    })

    expect(respuesta.status).toBe(201)
    expect(respuesta.cuerpo).toEqual({
      jobSchedulesId: expect.any(Number),
      job: TRABAJO_7,
      date: '2026-11-02',
      startTime: '07:00',
      employeesIds: [],
      scheduleComment: null,
    })
    expect(await buscarProgramacion(respuesta.cuerpo.jobSchedulesId)).toEqual(respuesta.cuerpo)
  })

  it('asigna un id nuevo, distinto de los de la semilla', async () => {
    const respuesta = await pedir('POST', '/v1/schedules', { jobsId: 1, date: '2026-11-03', startTime: '10:00' })

    expect([1, 2, 3, 4]).not.toContain(respuesta.cuerpo.jobSchedulesId)
  })

  it('crea con los employeesIds enviados', async () => {
    const respuesta = await pedir('POST', '/v1/schedules', {
      jobsId: 7,
      date: '2026-11-02',
      startTime: '10:00',
      employeesIds: [5, 3],
    })

    expect(respuesta.status).toBe(201)
    expect(ordenados(respuesta.cuerpo.employeesIds)).toEqual([3, 5])
  })

  it('Mismo trabajo y día repetidos: 201 y quedan dos programaciones del trabajo 7', async () => {
    usarSemilla((semilla) => {
      semilla.schedules = [PROGRAMACION_101]
    })

    const respuesta = await pedir('POST', '/v1/schedules', {
      jobsId: 7,
      date: '2026-11-02',
      startTime: '08:00',
    })

    expect(respuesta.status).toBe(201)
    const delDia = (await semana()).filter(
      (programacion) => programacion.job.jobsId === 7 && programacion.date === '2026-11-02',
    )
    expect(delDia).toHaveLength(2)
    expect(new Set(delDia.map((programacion) => programacion.jobSchedulesId)).size).toBe(2)
  })

  it('Empleado inactivo: 422 y no se crea la programación', async () => {
    const respuesta = await pedir('POST', '/v1/schedules', {
      jobsId: 7,
      date: '2026-11-02',
      startTime: '10:00',
      employeesIds: [3, 9],
    })

    esperarError(respuesta, 422, 'El empleado 9 está inactivo')
    expect(await semana()).toHaveLength(4)
  })

  it('Empleado inactivo: el 10 (Terminated) solo también da 422', async () => {
    const respuesta = await pedir('POST', '/v1/schedules', {
      jobsId: 7,
      date: '2026-11-02',
      startTime: '10:00',
      employeesIds: [10],
    })

    esperarError(respuesta, 422, 'El empleado 10 está inactivo')
    expect(await semana()).toHaveLength(4)
  })

  it('un empleado que pasa a Terminated en la semilla ya no se puede asignar al crear', async () => {
    usarSemilla((semilla) => {
      semilla.employees[2] = { ...semilla.employees[2], status: 'Terminated' }
    })

    const respuesta = await pedir('POST', '/v1/schedules', {
      jobsId: 7,
      date: '2026-11-02',
      startTime: '10:00',
      employeesIds: [3],
    })

    esperarError(respuesta, 422, 'El empleado 3 está inactivo')
  })

  it('caso límite 4: ignora los ids repetidos y la respuesta no los trae', async () => {
    const respuesta = await pedir('POST', '/v1/schedules', {
      jobsId: 7,
      date: '2026-11-02',
      startTime: '10:00',
      employeesIds: [3, 3, 5, 3],
    })

    expect(respuesta.status).toBe(201)
    expect(ordenados(respuesta.cuerpo.employeesIds)).toEqual([3, 5])
  })

  it.each<[string, Record<string, unknown>, string]>([
    ['el trabajo no existe', { jobsId: 999, date: '2026-11-02', startTime: '07:00' }, 'No existe el trabajo 999'],
    ['falta la fecha', { jobsId: 7, startTime: '07:00' }, 'La fecha no es válida'],
    ['la fecha no existe', { jobsId: 7, date: '2026-02-30', startTime: '07:00' }, 'La fecha no es válida'],
    ['la fecha no es AAAA-MM-DD', { jobsId: 7, date: '02/11/2026', startTime: '07:00' }, 'La fecha no es válida'],
    ['falta la hora', { jobsId: 7, date: '2026-11-02' }, 'La hora debe tener el formato HH:mm'],
    ['la hora no tiene dos dígitos', { jobsId: 7, date: '2026-11-02', startTime: '7:00' }, 'La hora debe tener el formato HH:mm'],
    ['la hora es 24:00', { jobsId: 7, date: '2026-11-02', startTime: '24:00' }, 'La hora debe tener el formato HH:mm'],
    [
      'caso límite 5: la hora trae segundos',
      { jobsId: 7, date: '2026-11-02', startTime: '08:00:00' },
      'La hora debe tener el formato HH:mm',
    ],
    [
      'un empleado no existe',
      { jobsId: 7, date: '2026-11-02', startTime: '07:00', employeesIds: [3, 999] },
      'No existe el empleado 999',
    ],
    ['falta jobsId', { date: '2026-11-02', startTime: '07:00' }, 'El cuerpo de la petición no es válido'],
    [
      'employeesIds no es una lista',
      { jobsId: 7, date: '2026-11-02', startTime: '07:00', employeesIds: 3 },
      'El cuerpo de la petición no es válido',
    ],
  ])('422 sin crear nada cuando %s', async (_descripcion, cuerpo, mensaje) => {
    esperarError(await pedir('POST', '/v1/schedules', cuerpo), 422, mensaje)
    expect(await semana()).toHaveLength(4)
  })

  it('422 cuando el cuerpo no es JSON', async () => {
    esperarError(
      await pedir('POST', '/v1/schedules', { crudo: '{"jobsId": 7,' }),
      422,
      'El cuerpo de la petición no es válido',
    )
  })
})

describe('PATCH /v1/schedules/{id}', () => {
  beforeEach(() => {
    conProgramacion101()
  })

  it('Mover a otro día: 200 con la nueva fecha, la misma hora y los mismos empleados', async () => {
    const respuesta = await pedir('PATCH', '/v1/schedules/101', { date: '2026-11-04' })

    expect(respuesta.status).toBe(200)
    expect({ ...respuesta.cuerpo, employeesIds: ordenados(respuesta.cuerpo.employeesIds) }).toEqual({
      ...PROGRAMACION_101,
      date: '2026-11-04',
    })
    const guardada = await buscarProgramacion(101)
    expect(guardada?.date).toBe('2026-11-04')
    expect(guardada?.startTime).toBe('08:00')
    expect(ordenados(guardada?.employeesIds ?? [])).toEqual([3, 5])
  })

  it('solo startTime: cambia la hora y conserva la fecha', async () => {
    const respuesta = await pedir('PATCH', '/v1/schedules/101', { startTime: '10:30' })

    expect(respuesta.status).toBe(200)
    expect(respuesta.cuerpo).toMatchObject({ jobSchedulesId: 101, date: '2026-11-02', startTime: '10:30' })
    expect(ordenados(respuesta.cuerpo.employeesIds)).toEqual([3, 5])
  })

  it('date y startTime a la vez cambian los dos', async () => {
    const respuesta = await pedir('PATCH', '/v1/schedules/101', {
      date: '2026-11-06',
      startTime: '13:15',
    })

    expect(respuesta.status).toBe(200)
    expect(respuesta.cuerpo).toMatchObject({ date: '2026-11-06', startTime: '13:15', job: TRABAJO_7 })
  })

  it('Programación inexistente: 404 con el mensaje exacto', async () => {
    esperarError(
      await pedir('PATCH', '/v1/schedules/99999', { date: '2026-11-04' }),
      404,
      'No existe la programación 99999',
    )
  })

  it('caso límite 7: id no numérico da 404', async () => {
    esperarError(
      await pedir('PATCH', '/v1/schedules/abc', { date: '2026-11-04' }),
      404,
      'No existe la programación abc',
    )
  })

  it('caso límite 3: sin date, startTime ni scheduleComment da 422 y no cambia nada', async () => {
    esperarError(await pedir('PATCH', '/v1/schedules/101', {}), 422, 'Debes enviar date, startTime o scheduleComment')
    expect(await buscarProgramacion(101)).toEqual(PROGRAMACION_101)
  })

  it.each<[string, Record<string, unknown>, string]>([
    ['la fecha no existe', { date: '2026-02-30' }, 'La fecha no es válida'],
    ['la fecha no es AAAA-MM-DD', { date: '4/11/2026' }, 'La fecha no es válida'],
    ['caso límite 5: la hora trae segundos', { startTime: '08:00:00' }, 'La hora debe tener el formato HH:mm'],
    ['la hora no es válida', { startTime: '25:00' }, 'La hora debe tener el formato HH:mm'],
    [
      'la fecha es válida pero la hora no',
      { date: '2026-11-04', startTime: '8:00' },
      'La hora debe tener el formato HH:mm',
    ],
  ])('422 sin cambios cuando %s', async (_descripcion, cuerpo, mensaje) => {
    esperarError(await pedir('PATCH', '/v1/schedules/101', cuerpo), 422, mensaje)
    expect(await buscarProgramacion(101)).toEqual(PROGRAMACION_101)
  })

  it('422 sin cambios cuando el cuerpo no es JSON', async () => {
    esperarError(
      await pedir('PATCH', '/v1/schedules/101', { crudo: '{"date":' }),
      422,
      'El cuerpo de la petición no es válido',
    )
    expect(await buscarProgramacion(101)).toEqual(PROGRAMACION_101)
  })
})

describe('comentario de una programación (tarea 12.1)', () => {
  /** Añade a la semilla la programación 101 con el comentario "Llevar escalera". */
  const conComentario = () =>
    usarSemilla((semilla) => {
      semilla.schedules.push({ ...PROGRAMACION_101, scheduleComment: 'Llevar escalera' })
    })

  it('el GET devuelve scheduleComment: la 1 de la semilla tiene "Llevar escalera" y las demás null', async () => {
    const comentarios = (await semana()).map((programacion) => [programacion.jobSchedulesId, programacion.scheduleComment])

    expect(comentarios).toEqual([
      [1, 'Llevar escalera'],
      [2, null],
      [3, null],
      [4, null],
    ])
  })

  describe('POST', () => {
    it('Creación válida: sin scheduleComment la nueva programación tiene scheduleComment null', async () => {
      const respuesta = await pedir('POST', '/v1/schedules', { jobsId: 7, date: '2026-11-02', startTime: '07:00' })

      expect(respuesta.status).toBe(201)
      expect(respuesta.cuerpo.scheduleComment).toBeNull()
    })

    it('Creación con comentario: 201 con scheduleComment "Llevar escalera" y se guarda', async () => {
      const respuesta = await pedir('POST', '/v1/schedules', {
        jobsId: 7,
        date: '2026-11-02',
        startTime: '07:00',
        scheduleComment: 'Llevar escalera',
      })

      expect(respuesta.status).toBe(201)
      expect(respuesta.cuerpo.scheduleComment).toBe('Llevar escalera')
      expect((await buscarProgramacion(respuesta.cuerpo.jobSchedulesId))?.scheduleComment).toBe('Llevar escalera')
    })

    it.each<[string, string | null]>([
      ['null', null],
      ['vacío', ''],
      ['solo espacios', '   '],
      ['solo saltos de línea y tabuladores', '\n\t \n'],
    ])('con scheduleComment %s crea la programación con scheduleComment null', async (_descripcion, comentario) => {
      const respuesta = await pedir('POST', '/v1/schedules', {
        jobsId: 7,
        date: '2026-11-02',
        startTime: '07:00',
        scheduleComment: comentario,
      })

      expect(respuesta.status).toBe(201)
      expect(respuesta.cuerpo.scheduleComment).toBeNull()
    })

    it('conserva los saltos de línea del comentario', async () => {
      const respuesta = await pedir('POST', '/v1/schedules', {
        jobsId: 7,
        date: '2026-11-02',
        startTime: '07:00',
        scheduleComment: 'Llevar escalera\nY rodillos',
      })

      expect(respuesta.cuerpo.scheduleComment).toBe('Llevar escalera\nY rodillos')
    })

    it.each<[string, unknown]>([
      ['un número', 5],
      ['un objeto', { texto: 'Llevar escalera' }],
      ['una lista', ['Llevar escalera']],
      ['un booleano', true],
    ])('422 sin crear nada cuando scheduleComment es %s', async (_descripcion, comentario) => {
      esperarError(
        await pedir('POST', '/v1/schedules', { jobsId: 7, date: '2026-11-02', startTime: '07:00', scheduleComment: comentario }),
        422,
        'El cuerpo de la petición no es válido',
      )
      expect(await semana()).toHaveLength(4)
    })
  })

  describe('PATCH', () => {
    beforeEach(() => {
      conComentario()
    })

    it('Cambiar el comentario: 200 con el nuevo scheduleComment y la misma fecha, hora y empleados', async () => {
      const respuesta = await pedir('PATCH', '/v1/schedules/101', { scheduleComment: 'Entrar por la puerta trasera' })

      expect(respuesta.status).toBe(200)
      expect({ ...respuesta.cuerpo, employeesIds: ordenados(respuesta.cuerpo.employeesIds) }).toEqual({
        ...PROGRAMACION_101,
        scheduleComment: 'Entrar por la puerta trasera',
      })
      expect(await buscarProgramacion(101)).toMatchObject({
        date: '2026-11-02',
        startTime: '08:00',
        scheduleComment: 'Entrar por la puerta trasera',
      })
    })

    it.each<[string, string | null]>([
      ['solo espacios ("  ")', '  '],
      ['vacío', ''],
      ['null', null],
    ])('Borrar el comentario: con scheduleComment %s responde 200 con scheduleComment null', async (_descripcion, comentario) => {
      const respuesta = await pedir('PATCH', '/v1/schedules/101', { scheduleComment: comentario })

      expect(respuesta.status).toBe(200)
      expect(respuesta.cuerpo.scheduleComment).toBeNull()
      expect((await buscarProgramacion(101))?.scheduleComment).toBeNull()
    })

    it('Mover a otro día: PATCH con solo date conserva el comentario, la hora y los empleados', async () => {
      const respuesta = await pedir('PATCH', '/v1/schedules/101', { date: '2026-11-04' })

      expect(respuesta.status).toBe(200)
      expect({ ...respuesta.cuerpo, employeesIds: ordenados(respuesta.cuerpo.employeesIds) }).toEqual({
        ...PROGRAMACION_101,
        date: '2026-11-04',
        scheduleComment: 'Llevar escalera',
      })
    })

    it('PATCH con solo startTime conserva el comentario', async () => {
      const respuesta = await pedir('PATCH', '/v1/schedules/101', { startTime: '10:30' })

      expect(respuesta.cuerpo).toMatchObject({ startTime: '10:30', scheduleComment: 'Llevar escalera' })
    })

    it('date, startTime y scheduleComment a la vez cambian los tres', async () => {
      const respuesta = await pedir('PATCH', '/v1/schedules/101', {
        date: '2026-11-06',
        startTime: '13:15',
        scheduleComment: 'Llevar andamio',
      })

      expect(respuesta.status).toBe(200)
      expect(respuesta.cuerpo).toMatchObject({ date: '2026-11-06', startTime: '13:15', scheduleComment: 'Llevar andamio' })
    })

    it('el PUT de empleados conserva el comentario', async () => {
      const respuesta = await pedir('PUT', '/v1/schedules/101/employees', { employeesIds: [8] })

      expect(respuesta.cuerpo.scheduleComment).toBe('Llevar escalera')
    })

    it('PATCH vacío: 422 "Debes enviar date, startTime o scheduleComment" y el comentario no cambia', async () => {
      esperarError(await pedir('PATCH', '/v1/schedules/101', {}), 422, 'Debes enviar date, startTime o scheduleComment')
      expect((await buscarProgramacion(101))?.scheduleComment).toBe('Llevar escalera')
    })

    it.each<[string, unknown]>([
      ['un número', 5],
      ['un objeto', { texto: 'Llevar andamio' }],
      ['una lista', ['Llevar andamio']],
      ['un booleano', false],
    ])('422 "El comentario no es válido" sin cambios cuando scheduleComment es %s', async (_descripcion, comentario) => {
      esperarError(await pedir('PATCH', '/v1/schedules/101', { scheduleComment: comentario }), 422, 'El comentario no es válido')
      expect((await buscarProgramacion(101))?.scheduleComment).toBe('Llevar escalera')
    })

    it('un comentario no válido junto a una fecha válida tampoco cambia la fecha', async () => {
      esperarError(
        await pedir('PATCH', '/v1/schedules/101', { date: '2026-11-04', scheduleComment: 5 }),
        422,
        'El comentario no es válido',
      )
      expect((await buscarProgramacion(101))?.date).toBe('2026-11-02')
    })

    it('404 si la programación no existe', async () => {
      esperarError(
        await pedir('PATCH', '/v1/schedules/99999', { scheduleComment: 'Llevar andamio' }),
        404,
        'No existe la programación 99999',
      )
    })
  })
})

describe('DELETE /v1/schedules/{id}', () => {
  beforeEach(() => {
    conProgramacion101()
  })

  it('Eliminación: 204 sin cuerpo y la 101 ya no aparece en GET /v1/schedules', async () => {
    const respuesta = await pedir('DELETE', '/v1/schedules/101')

    expect(respuesta.status).toBe(204)
    expect(respuesta.texto).toBe('')
    const programaciones = await semana()
    expect(programaciones.map((programacion) => programacion.jobSchedulesId)).not.toContain(101)
    expect(programaciones).toHaveLength(4)
  })

  it('no afecta al catálogo ni a otras programaciones del mismo trabajo', async () => {
    await pedir('DELETE', '/v1/schedules/101')

    const { cuerpo: trabajos } = await pedir('GET', '/v1/job')
    expect(trabajos).toContainEqual(TRABAJO_7)
    expect(trabajos).toHaveLength(30)
    // La semilla tiene las programaciones 1 y 2 del trabajo 7.
    const delTrabajo7 = (await semana()).filter((programacion) => programacion.job.jobsId === 7)
    expect(delTrabajo7.map((programacion) => programacion.jobSchedulesId)).toEqual([1, 2])
  })

  it('borrar dos veces da 404 la segunda', async () => {
    await pedir('DELETE', '/v1/schedules/101')

    esperarError(await pedir('DELETE', '/v1/schedules/101'), 404, 'No existe la programación 101')
  })

  it('404 con el mensaje exacto si no existe', async () => {
    esperarError(await pedir('DELETE', '/v1/schedules/99999'), 404, 'No existe la programación 99999')
    expect(await semana()).toHaveLength(5)
  })

  it('caso límite 7: id no numérico da 404', async () => {
    esperarError(await pedir('DELETE', '/v1/schedules/abc'), 404, 'No existe la programación abc')
  })
})

describe('PUT /v1/schedules/{id}/employees', () => {
  beforeEach(() => {
    conProgramacion101()
  })

  it('Reemplazo: [3, 5] pasa a [5, 8]', async () => {
    const respuesta = await pedir('PUT', '/v1/schedules/101/employees', { employeesIds: [5, 8] })

    expect(respuesta.status).toBe(200)
    expect({ ...respuesta.cuerpo, employeesIds: ordenados(respuesta.cuerpo.employeesIds) }).toEqual({
      ...PROGRAMACION_101,
      employeesIds: [5, 8],
    })
    expect(ordenados((await buscarProgramacion(101))?.employeesIds ?? [])).toEqual([5, 8])
  })

  it('Conservar un inactivo ya asignado: [9, 5] con [9, 3] da 200 con [9, 3]', async () => {
    conProgramacion101([9, 5])

    const respuesta = await pedir('PUT', '/v1/schedules/101/employees', { employeesIds: [9, 3] })

    expect(respuesta.status).toBe(200)
    expect(ordenados(respuesta.cuerpo.employeesIds)).toEqual([3, 9])
    expect(ordenados((await buscarProgramacion(101))?.employeesIds ?? [])).toEqual([3, 9])
  })

  it('Agregar un inactivo: 422 y la asignación no cambia', async () => {
    const respuesta = await pedir('PUT', '/v1/schedules/101/employees', { employeesIds: [9] })

    esperarError(respuesta, 422, 'El empleado 9 está inactivo')
    expect(ordenados((await buscarProgramacion(101))?.employeesIds ?? [])).toEqual([3, 5])
  })

  it('un inactivo ya asignado no permite agregar otro inactivo', async () => {
    conProgramacion101([9])

    const respuesta = await pedir('PUT', '/v1/schedules/101/employees', { employeesIds: [9, 10] })

    esperarError(respuesta, 422, 'El empleado 10 está inactivo')
    expect((await buscarProgramacion(101))?.employeesIds).toEqual([9])
  })

  it('caso límite 2: con [] deja la programación sin empleados y responde 200', async () => {
    const respuesta = await pedir('PUT', '/v1/schedules/101/employees', { employeesIds: [] })

    expect(respuesta.status).toBe(200)
    expect(respuesta.cuerpo.employeesIds).toEqual([])
    expect((await buscarProgramacion(101))?.employeesIds).toEqual([])
  })

  it('ignora los ids repetidos', async () => {
    const respuesta = await pedir('PUT', '/v1/schedules/101/employees', { employeesIds: [5, 8, 5, 8] })

    expect(respuesta.status).toBe(200)
    expect(ordenados(respuesta.cuerpo.employeesIds)).toEqual([5, 8])
  })

  it('no cambia la fecha, la hora ni el trabajo', async () => {
    const respuesta = await pedir('PUT', '/v1/schedules/101/employees', { employeesIds: [1] })

    expect(respuesta.cuerpo).toMatchObject({ jobSchedulesId: 101, job: TRABAJO_7, date: '2026-11-02', startTime: '08:00' })
  })

  it('422 sin cambios cuando un empleado no existe', async () => {
    esperarError(
      await pedir('PUT', '/v1/schedules/101/employees', { employeesIds: [5, 999] }),
      422,
      'No existe el empleado 999',
    )
    expect(ordenados((await buscarProgramacion(101))?.employeesIds ?? [])).toEqual([3, 5])
  })

  it.each<[string, unknown]>([
    ['falta employeesIds', {}],
    ['employeesIds no es una lista', { employeesIds: 5 }],
    ['el cuerpo no es JSON', { crudo: '{"employeesIds": [' }],
  ])('422 sin cambios cuando %s', async (_descripcion, cuerpo) => {
    esperarError(
      await pedir('PUT', '/v1/schedules/101/employees', cuerpo),
      422,
      'El cuerpo de la petición no es válido',
    )
    expect(ordenados((await buscarProgramacion(101))?.employeesIds ?? [])).toEqual([3, 5])
  })

  it('404 con el mensaje exacto si no existe', async () => {
    esperarError(
      await pedir('PUT', '/v1/schedules/99999/employees', { employeesIds: [5] }),
      404,
      'No existe la programación 99999',
    )
  })

  it('caso límite 7: id no numérico da 404', async () => {
    esperarError(
      await pedir('PUT', '/v1/schedules/abc/employees', { employeesIds: [5] }),
      404,
      'No existe la programación abc',
    )
  })
})

describe('comodín de origen: interceptan la misma ruta v1/... desde cualquier URL base (tarea 11.7)', () => {
  // `fetch` de Node no aplica CORS, así que se puede pedir a otro origen sin cabeceras extra.
  it.each([
    ['el mismo origen de la página', ''],
    ['otro origen con prefijo /api', 'https://api-gateway.example.com/api'],
    ['otro origen sin prefijo', 'https://otro.example.com'],
  ])('desde %s los siete endpoints responden con los datos de prueba', async (_descripcion, base) => {
    conProgramacion101()

    const empleados = await pedir('GET', `${base}/v1/employee?status=Active`)
    expect(empleados.status).toBe(200)
    expect(empleados.cuerpo).toHaveLength(8)

    const trabajos = await pedir('GET', `${base}/v1/job?search=pintar`)
    expect(trabajos.status).toBe(200)
    expect(trabajos.cuerpo).toContainEqual(TRABAJO_7)

    const semanaCompleta = await pedir('GET', `${base}/v1/schedules?from=2026-11-01&to=2026-11-07`)
    expect(semanaCompleta.status).toBe(200)
    expect(semanaCompleta.cuerpo).toHaveLength(5)

    const creada = await pedir('POST', `${base}/v1/schedules`, { jobsId: 7, date: '2026-11-03', startTime: '07:00' })
    expect(creada.status).toBe(201)

    const movida = await pedir('PATCH', `${base}/v1/schedules/101`, { date: '2026-11-04' })
    expect(movida.status).toBe(200)
    expect(movida.cuerpo.date).toBe('2026-11-04')

    const reemplazada = await pedir('PUT', `${base}/v1/schedules/101/employees`, { employeesIds: [5, 8] })
    expect(reemplazada.status).toBe(200)
    expect(ordenados(reemplazada.cuerpo.employeesIds)).toEqual([5, 8])

    const borrada = await pedir('DELETE', `${base}/v1/schedules/${creada.cuerpo.jobSchedulesId}`)
    expect(borrada.status).toBe(204)
  })

  it('el cliente con URL base vacía usa los manejadores sin pasar por CORS', async () => {
    const api = createApiClient('')

    const empleados = await api.getEmployees({ status: 'Terminated' })

    expect(empleados.map((empleado) => empleado.employeesId)).toEqual([10, 9])
  })
})

describe('autenticación', () => {
  it('GET /auth/me responde 200 con el usuario de prueba "Demo User"', async () => {
    const respuesta = await pedir('GET', '/auth/me')

    expect(respuesta.status).toBe(200)
    expect(respuesta.cuerpo).toEqual({
      email: 'demo@hmbrandt.com',
      fullName: 'Demo User',
      id: '1',
      roles: [{ id: 1, name: 'Admin' }],
    })
  })

  it('POST /auth/refresh responde 200 con token, refreshToken y userId', async () => {
    const respuesta = await pedir('POST', '/auth/refresh', { refreshToken: 'r-viejo' })

    expect(respuesta.status).toBe(200)
    expect(respuesta.cuerpo).toEqual({ token: 'mock-token', refreshToken: 'mock-refresh-token', userId: '1' })
  })

  it.each([
    ['el mismo origen de la página', ''],
    ['otro origen con prefijo /api', 'https://api-gateway.example.com/api'],
  ])('desde %s también responden auth/me y auth/refresh', async (_descripcion, base) => {
    const yo = await pedir('GET', `${base}/auth/me`)
    const refresco = await pedir('POST', `${base}/auth/refresh`, { refreshToken: 'r-viejo' })

    expect(yo.status).toBe(200)
    expect(yo.cuerpo.fullName).toBe('Demo User')
    expect(refresco.status).toBe(200)
    expect(refresco.cuerpo.token).toBe('mock-token')
  })

  it('el cliente obtiene el usuario de prueba con getMe', async () => {
    const api = createApiClient('')

    const usuario = await api.getMe()

    expect(usuario.fullName).toBe('Demo User')
    expect(usuario.roles).toEqual([{ id: 1, name: 'Admin' }])
  })
})

describe('estado en memoria', () => {
  it('cada createHandlers parte de la semilla sin los cambios de otro', async () => {
    const semilla = createSeed(HOY)
    server.resetHandlers(...createHandlers(semilla))
    await pedir('PUT', '/v1/schedules/1/employees', { employeesIds: [8] })
    await pedir('PATCH', '/v1/schedules/1', { date: '2026-11-06' })
    await pedir('DELETE', '/v1/schedules/2')

    // La semilla original no se modificó.
    expect(semilla.schedules[0]).toMatchObject({ jobSchedulesId: 1, date: '2026-11-02', employeesIds: [3, 5] })
    expect(semilla.schedules).toHaveLength(4)

    server.resetHandlers(...createHandlers(semilla))
    const programaciones = await semana()
    expect(programaciones.map((programacion) => programacion.jobSchedulesId)).toEqual([1, 2, 3, 4])
    expect(programaciones[0]).toMatchObject({ date: '2026-11-02' })
    expect(ordenados(programaciones[0].employeesIds)).toEqual([3, 5])
  })

  it('los cambios persisten entre peticiones del mismo servidor', async () => {
    const creada = await pedir('POST', '/v1/schedules', { jobsId: 7, date: '2026-11-05', startTime: '11:00' })
    await pedir('PUT', `/v1/schedules/${creada.cuerpo.jobSchedulesId}/employees`, { employeesIds: [2] })
    await pedir('PATCH', `/v1/schedules/${creada.cuerpo.jobSchedulesId}`, { startTime: '12:00' })

    expect(await buscarProgramacion(creada.cuerpo.jobSchedulesId)).toEqual({
      jobSchedulesId: creada.cuerpo.jobSchedulesId,
      job: TRABAJO_7,
      date: '2026-11-05',
      startTime: '12:00',
      employeesIds: [2],
      scheduleComment: null,
    })
  })
})
