// Tests de los manejadores MSW (tareas 3.2 y 3.3 de `schedule-assign`) con `msw/node`.
//
// Cada test parte de un estado limpio: `beforeEach` sustituye los manejadores por
// unos nuevos creados con `createHandlers(createSeed(HOY))`, que tienen su propia
// base en memoria.
//
// Los manejadores usan rutas relativas (`/api/...`), que MSW resuelve contra
// `location` de jsdom (`http://localhost:3000`). Las peticiones se hacen con `fetch`
// a ese mismo origen, así que no hay CORS de por medio.
//
// Caso límite 1 de `docs/api.md`: el orden de `employee_ids` no está garantizado, por
// eso los tests los comparan ordenados.
import { setupServer } from 'msw/node'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Employee, Job, Schedule } from '../api/types'
import { createHandlers } from './handlers'
import { createSeed } from './seed'

/** Martes 2026-11-03: la semilla arma la semana del 2026-11-01 al 2026-11-07. */
const HOY = new Date(2026, 10, 3)

const TRABAJO_7: Job = { id: 7, number: 'J-1024', name: 'Pintar oficina' }

/** Programación 101 de los escenarios del spec. */
const PROGRAMACION_101: Schedule = {
  id: 101,
  job: TRABAJO_7,
  date: '2026-11-02',
  start_time: '08:00',
  employee_ids: [3, 5],
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
    semilla.schedules.push({ ...PROGRAMACION_101, employee_ids: employeeIds })
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
  const respuesta = await pedir('GET', '/api/schedules?from=2026-11-01&to=2026-11-07')
  expect(respuesta.status).toBe(200)
  return respuesta.cuerpo
}

async function buscarProgramacion(id: number): Promise<Schedule | undefined> {
  return (await semana()).find((programacion) => programacion.id === id)
}

const ordenados = (ids: number[]) => [...ids].sort((a, b) => a - b)

/** Comprueba un error 4xx con el cuerpo `{"error": mensaje}` exacto. */
function esperarError(respuesta: Respuesta, status: number, mensaje: string) {
  expect(respuesta.status).toBe(status)
  expect(respuesta.cuerpo).toEqual({ error: mensaje })
}

describe('GET /api/employees', () => {
  it('Todos: 200 con empleados activos e inactivos', async () => {
    const respuesta = await pedir('GET', '/api/employees')

    expect(respuesta.status).toBe(200)
    const empleados: Employee[] = respuesta.cuerpo
    expect(empleados).toHaveLength(10)
    expect(empleados.some((empleado) => empleado.status === 'activo')).toBe(true)
    expect(empleados.some((empleado) => empleado.status === 'inactivo')).toBe(true)
  })

  it('cada empleado tiene la forma {id, first_name, last_name, title, status}', async () => {
    const { cuerpo } = await pedir('GET', '/api/employees')

    expect(cuerpo).toContainEqual({
      id: 3,
      first_name: 'Ana',
      last_name: 'López',
      title: 'Pintora',
      status: 'activo',
    })
    for (const empleado of cuerpo as Employee[]) {
      expect(Object.keys(empleado).sort()).toEqual(
        ['first_name', 'id', 'last_name', 'status', 'title'].sort(),
      )
    }
  })

  it('Solo activos: ?status=activo devuelve solo los activos', async () => {
    const respuesta = await pedir('GET', '/api/employees?status=activo')

    expect(respuesta.status).toBe(200)
    const empleados: Employee[] = respuesta.cuerpo
    expect(empleados).toHaveLength(8)
    expect(empleados.every((empleado) => empleado.status === 'activo')).toBe(true)
  })

  it('?status=inactivo devuelve solo los inactivos', async () => {
    const respuesta = await pedir('GET', '/api/employees?status=inactivo')

    expect(respuesta.status).toBe(200)
    expect((respuesta.cuerpo as Employee[]).map((empleado) => empleado.id)).toEqual([10, 9])
  })

  it('ordena por first_name', async () => {
    const { cuerpo } = await pedir('GET', '/api/employees')

    expect(
      (cuerpo as Employee[]).map((empleado) => `${empleado.first_name} ${empleado.last_name}`),
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

  it('con el mismo first_name desempata por last_name', async () => {
    usarSemilla((semilla) => {
      semilla.employees.push(
        { id: 12, first_name: 'Ana', last_name: 'Zapata', title: 'Ayudante', status: 'activo' },
        { id: 11, first_name: 'Ana', last_name: 'Abad', title: 'Ayudante', status: 'activo' },
      )
    })

    const { cuerpo } = await pedir('GET', '/api/employees?status=activo')

    expect((cuerpo as Employee[]).slice(0, 3).map((empleado) => empleado.id)).toEqual([11, 3, 12])
  })

  it('caso límite 6: ?status=otro da 422 con el mensaje exacto', async () => {
    esperarError(await pedir('GET', '/api/employees?status=otro'), 422, 'El estado "otro" no es válido')
  })
})

describe('GET /api/jobs', () => {
  it('sin search devuelve todo el catálogo con la forma {id, number, name}', async () => {
    const respuesta = await pedir('GET', '/api/jobs')

    expect(respuesta.status).toBe(200)
    expect(respuesta.cuerpo).toHaveLength(30)
    expect(respuesta.cuerpo).toContainEqual(TRABAJO_7)
    for (const trabajo of respuesta.cuerpo as Job[]) {
      expect(Object.keys(trabajo).sort()).toEqual(['id', 'name', 'number'])
    }
  })

  it('ordena por number aunque el catálogo venga desordenado', async () => {
    usarSemilla((semilla) => {
      semilla.jobs.reverse()
    })

    const { cuerpo } = await pedir('GET', '/api/jobs')
    const numeros = (cuerpo as Job[]).map((trabajo) => trabajo.number)

    expect(numeros[0]).toBe('J-1018')
    expect(numeros.at(-1)).toBe('J-1047')
    expect(numeros).toEqual([...numeros].sort())
  })

  it('Búsqueda por nombre: ?search=pintar incluye "Pintar oficina"', async () => {
    const respuesta = await pedir('GET', '/api/jobs?search=pintar')

    expect(respuesta.status).toBe(200)
    const trabajos: Job[] = respuesta.cuerpo
    expect(trabajos).toContainEqual(TRABAJO_7)
    expect(trabajos.map((trabajo) => trabajo.name)).toEqual(['Pintar oficina', 'Pintar pasillo'])
    expect(trabajos.map((trabajo) => trabajo.number)).toEqual(['J-1024', 'J-1039'])
  })

  it.each([['PINTAR'], ['Pintar'], ['pInTaR']])(
    'la búsqueda no distingue mayúsculas (%s)',
    async (texto) => {
      const { cuerpo } = await pedir('GET', `/api/jobs?search=${texto}`)

      expect((cuerpo as Job[]).map((trabajo) => trabajo.id)).toEqual([7, 22])
    },
  )

  it('busca también por number, sin distinguir mayúsculas', async () => {
    const { cuerpo } = await pedir('GET', '/api/jobs?search=j-1024')

    expect(cuerpo).toEqual([TRABAJO_7])
  })

  it('busca texto en medio del nombre', async () => {
    const { cuerpo } = await pedir('GET', `/api/jobs?search=${encodeURIComponent('r OFIC')}`)

    expect(cuerpo).toEqual([TRABAJO_7])
  })

  it('sin coincidencias devuelve 200 con lista vacía', async () => {
    const respuesta = await pedir('GET', '/api/jobs?search=zzz')

    expect(respuesta.status).toBe(200)
    expect(respuesta.cuerpo).toEqual([])
  })

  it('search vacío devuelve todo el catálogo', async () => {
    const { cuerpo } = await pedir('GET', '/api/jobs?search=')

    expect(cuerpo).toHaveLength(30)
  })
})

describe('GET /api/schedules', () => {
  it('Programación con dos empleados: la representación es la del spec', async () => {
    usarSemilla((semilla) => {
      semilla.schedules = [PROGRAMACION_101]
    })

    const respuesta = await pedir('GET', '/api/schedules?from=2026-11-01&to=2026-11-07')

    expect(respuesta.status).toBe(200)
    expect(respuesta.cuerpo).toEqual([
      {
        id: 101,
        job: { id: 7, number: 'J-1024', name: 'Pintar oficina' },
        date: '2026-11-02',
        start_time: '08:00',
        employee_ids: [3, 5],
      },
    ])
  })

  it('devuelve las programaciones de la semilla con la forma del contrato', async () => {
    const programaciones = await semana()

    expect(programaciones).toHaveLength(4)
    for (const programacion of programaciones) {
      expect(Object.keys(programacion).sort()).toEqual(
        ['date', 'employee_ids', 'id', 'job', 'start_time'].sort(),
      )
      expect(programacion.start_time).toMatch(/^\d{2}:\d{2}$/)
    }
  })

  it('Semana completa: incluye las del día 7 y excluye las de fuera del rango', async () => {
    const sabado = await pedir('POST', '/api/schedules', { job_id: 1, date: '2026-11-07', start_time: '09:00' })
    const antes = await pedir('POST', '/api/schedules', { job_id: 2, date: '2026-10-31', start_time: '09:00' })
    const despues = await pedir('POST', '/api/schedules', { job_id: 3, date: '2026-11-08', start_time: '09:00' })

    const respuesta = await pedir('GET', '/api/schedules?from=2026-11-01&to=2026-11-07')

    expect(respuesta.status).toBe(200)
    const ids = (respuesta.cuerpo as Schedule[]).map((programacion) => programacion.id)
    expect(ids).toContain(sabado.cuerpo.id)
    expect(ids).not.toContain(antes.cuerpo.id)
    expect(ids).not.toContain(despues.cuerpo.id)
    expect(ids).toHaveLength(5)
  })

  it('from igual a to devuelve solo ese día', async () => {
    const respuesta = await pedir('GET', '/api/schedules?from=2026-11-02&to=2026-11-02')

    expect(respuesta.status).toBe(200)
    expect((respuesta.cuerpo as Schedule[]).every((programacion) => programacion.date === '2026-11-02')).toBe(true)
    expect(respuesta.cuerpo).toHaveLength(2)
  })

  it('ordena por fecha, hora de inicio e id', async () => {
    // La semilla tiene 1 (02, 07:00), 2 (02, 08:00), 3 (03, 07:00) y 4 (05, 09:30).
    const temprana = await pedir('POST', '/api/schedules', { job_id: 1, date: '2026-11-02', start_time: '06:00' })
    const empate = await pedir('POST', '/api/schedules', { job_id: 2, date: '2026-11-02', start_time: '07:00' })
    const domingo = await pedir('POST', '/api/schedules', { job_id: 3, date: '2026-11-01', start_time: '23:00' })

    const ids = (await semana()).map((programacion) => programacion.id)

    expect(ids).toEqual([domingo.cuerpo.id, temprana.cuerpo.id, 1, empate.cuerpo.id, 2, 3, 4])
  })

  it('Rango invertido: 422 con el mensaje exacto', async () => {
    esperarError(
      await pedir('GET', '/api/schedules?from=2026-11-07&to=2026-11-01'),
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
      await pedir('GET', `/api/schedules${query}`),
      422,
      'Los parámetros from y to deben ser fechas AAAA-MM-DD',
    )
  })
})

describe('POST /api/schedules', () => {
  it('Creación válida: 201 con la nueva programación y employee_ids vacío', async () => {
    const respuesta = await pedir('POST', '/api/schedules', {
      job_id: 7,
      date: '2026-11-02',
      start_time: '07:00',
    })

    expect(respuesta.status).toBe(201)
    expect(respuesta.cuerpo).toEqual({
      id: expect.any(Number),
      job: TRABAJO_7,
      date: '2026-11-02',
      start_time: '07:00',
      employee_ids: [],
    })
    expect(await buscarProgramacion(respuesta.cuerpo.id)).toEqual(respuesta.cuerpo)
  })

  it('asigna un id nuevo, distinto de los de la semilla', async () => {
    const respuesta = await pedir('POST', '/api/schedules', { job_id: 1, date: '2026-11-03', start_time: '10:00' })

    expect([1, 2, 3, 4]).not.toContain(respuesta.cuerpo.id)
  })

  it('crea con los employee_ids enviados', async () => {
    const respuesta = await pedir('POST', '/api/schedules', {
      job_id: 7,
      date: '2026-11-02',
      start_time: '10:00',
      employee_ids: [5, 3],
    })

    expect(respuesta.status).toBe(201)
    expect(ordenados(respuesta.cuerpo.employee_ids)).toEqual([3, 5])
  })

  it('Mismo trabajo y día repetidos: 201 y quedan dos programaciones del trabajo 7', async () => {
    usarSemilla((semilla) => {
      semilla.schedules = [PROGRAMACION_101]
    })

    const respuesta = await pedir('POST', '/api/schedules', {
      job_id: 7,
      date: '2026-11-02',
      start_time: '08:00',
    })

    expect(respuesta.status).toBe(201)
    const delDia = (await semana()).filter(
      (programacion) => programacion.job.id === 7 && programacion.date === '2026-11-02',
    )
    expect(delDia).toHaveLength(2)
    expect(new Set(delDia.map((programacion) => programacion.id)).size).toBe(2)
  })

  it('Empleado inactivo: 422 y no se crea la programación', async () => {
    const respuesta = await pedir('POST', '/api/schedules', {
      job_id: 7,
      date: '2026-11-02',
      start_time: '10:00',
      employee_ids: [3, 9],
    })

    esperarError(respuesta, 422, 'El empleado 9 está inactivo')
    expect(await semana()).toHaveLength(4)
  })

  it('caso límite 4: ignora los ids repetidos y la respuesta no los trae', async () => {
    const respuesta = await pedir('POST', '/api/schedules', {
      job_id: 7,
      date: '2026-11-02',
      start_time: '10:00',
      employee_ids: [3, 3, 5, 3],
    })

    expect(respuesta.status).toBe(201)
    expect(ordenados(respuesta.cuerpo.employee_ids)).toEqual([3, 5])
  })

  it.each<[string, Record<string, unknown>, string]>([
    ['el trabajo no existe', { job_id: 999, date: '2026-11-02', start_time: '07:00' }, 'No existe el trabajo 999'],
    ['falta la fecha', { job_id: 7, start_time: '07:00' }, 'La fecha no es válida'],
    ['la fecha no existe', { job_id: 7, date: '2026-02-30', start_time: '07:00' }, 'La fecha no es válida'],
    ['la fecha no es AAAA-MM-DD', { job_id: 7, date: '02/11/2026', start_time: '07:00' }, 'La fecha no es válida'],
    ['falta la hora', { job_id: 7, date: '2026-11-02' }, 'La hora debe tener el formato HH:mm'],
    ['la hora no tiene dos dígitos', { job_id: 7, date: '2026-11-02', start_time: '7:00' }, 'La hora debe tener el formato HH:mm'],
    ['la hora es 24:00', { job_id: 7, date: '2026-11-02', start_time: '24:00' }, 'La hora debe tener el formato HH:mm'],
    [
      'caso límite 5: la hora trae segundos',
      { job_id: 7, date: '2026-11-02', start_time: '08:00:00' },
      'La hora debe tener el formato HH:mm',
    ],
    [
      'un empleado no existe',
      { job_id: 7, date: '2026-11-02', start_time: '07:00', employee_ids: [3, 999] },
      'No existe el empleado 999',
    ],
    ['falta job_id', { date: '2026-11-02', start_time: '07:00' }, 'El cuerpo de la petición no es válido'],
    [
      'employee_ids no es una lista',
      { job_id: 7, date: '2026-11-02', start_time: '07:00', employee_ids: 3 },
      'El cuerpo de la petición no es válido',
    ],
  ])('422 sin crear nada cuando %s', async (_descripcion, cuerpo, mensaje) => {
    esperarError(await pedir('POST', '/api/schedules', cuerpo), 422, mensaje)
    expect(await semana()).toHaveLength(4)
  })

  it('422 cuando el cuerpo no es JSON', async () => {
    esperarError(
      await pedir('POST', '/api/schedules', { crudo: '{"job_id": 7,' }),
      422,
      'El cuerpo de la petición no es válido',
    )
  })
})

describe('PATCH /api/schedules/{id}', () => {
  beforeEach(() => {
    conProgramacion101()
  })

  it('Mover a otro día: 200 con la nueva fecha, la misma hora y los mismos empleados', async () => {
    const respuesta = await pedir('PATCH', '/api/schedules/101', { date: '2026-11-04' })

    expect(respuesta.status).toBe(200)
    expect({ ...respuesta.cuerpo, employee_ids: ordenados(respuesta.cuerpo.employee_ids) }).toEqual({
      ...PROGRAMACION_101,
      date: '2026-11-04',
    })
    const guardada = await buscarProgramacion(101)
    expect(guardada?.date).toBe('2026-11-04')
    expect(guardada?.start_time).toBe('08:00')
    expect(ordenados(guardada?.employee_ids ?? [])).toEqual([3, 5])
  })

  it('solo start_time: cambia la hora y conserva la fecha', async () => {
    const respuesta = await pedir('PATCH', '/api/schedules/101', { start_time: '10:30' })

    expect(respuesta.status).toBe(200)
    expect(respuesta.cuerpo).toMatchObject({ id: 101, date: '2026-11-02', start_time: '10:30' })
    expect(ordenados(respuesta.cuerpo.employee_ids)).toEqual([3, 5])
  })

  it('date y start_time a la vez cambian los dos', async () => {
    const respuesta = await pedir('PATCH', '/api/schedules/101', {
      date: '2026-11-06',
      start_time: '13:15',
    })

    expect(respuesta.status).toBe(200)
    expect(respuesta.cuerpo).toMatchObject({ date: '2026-11-06', start_time: '13:15', job: TRABAJO_7 })
  })

  it('Programación inexistente: 404 con el mensaje exacto', async () => {
    esperarError(
      await pedir('PATCH', '/api/schedules/99999', { date: '2026-11-04' }),
      404,
      'No existe la programación 99999',
    )
  })

  it('caso límite 7: id no numérico da 404', async () => {
    esperarError(
      await pedir('PATCH', '/api/schedules/abc', { date: '2026-11-04' }),
      404,
      'No existe la programación abc',
    )
  })

  it('caso límite 3: sin date ni start_time da 422 y no cambia nada', async () => {
    esperarError(await pedir('PATCH', '/api/schedules/101', {}), 422, 'Debes enviar date o start_time')
    expect(await buscarProgramacion(101)).toEqual(PROGRAMACION_101)
  })

  it.each<[string, Record<string, unknown>, string]>([
    ['la fecha no existe', { date: '2026-02-30' }, 'La fecha no es válida'],
    ['la fecha no es AAAA-MM-DD', { date: '4/11/2026' }, 'La fecha no es válida'],
    ['caso límite 5: la hora trae segundos', { start_time: '08:00:00' }, 'La hora debe tener el formato HH:mm'],
    ['la hora no es válida', { start_time: '25:00' }, 'La hora debe tener el formato HH:mm'],
    [
      'la fecha es válida pero la hora no',
      { date: '2026-11-04', start_time: '8:00' },
      'La hora debe tener el formato HH:mm',
    ],
  ])('422 sin cambios cuando %s', async (_descripcion, cuerpo, mensaje) => {
    esperarError(await pedir('PATCH', '/api/schedules/101', cuerpo), 422, mensaje)
    expect(await buscarProgramacion(101)).toEqual(PROGRAMACION_101)
  })

  it('422 sin cambios cuando el cuerpo no es JSON', async () => {
    esperarError(
      await pedir('PATCH', '/api/schedules/101', { crudo: '{"date":' }),
      422,
      'El cuerpo de la petición no es válido',
    )
    expect(await buscarProgramacion(101)).toEqual(PROGRAMACION_101)
  })
})

describe('DELETE /api/schedules/{id}', () => {
  beforeEach(() => {
    conProgramacion101()
  })

  it('Eliminación: 204 sin cuerpo y la 101 ya no aparece en GET /api/schedules', async () => {
    const respuesta = await pedir('DELETE', '/api/schedules/101')

    expect(respuesta.status).toBe(204)
    expect(respuesta.texto).toBe('')
    const programaciones = await semana()
    expect(programaciones.map((programacion) => programacion.id)).not.toContain(101)
    expect(programaciones).toHaveLength(4)
  })

  it('no afecta al catálogo ni a otras programaciones del mismo trabajo', async () => {
    await pedir('DELETE', '/api/schedules/101')

    const { cuerpo: trabajos } = await pedir('GET', '/api/jobs')
    expect(trabajos).toContainEqual(TRABAJO_7)
    expect(trabajos).toHaveLength(30)
    // La semilla tiene las programaciones 1 y 2 del trabajo 7.
    const delTrabajo7 = (await semana()).filter((programacion) => programacion.job.id === 7)
    expect(delTrabajo7.map((programacion) => programacion.id)).toEqual([1, 2])
  })

  it('borrar dos veces da 404 la segunda', async () => {
    await pedir('DELETE', '/api/schedules/101')

    esperarError(await pedir('DELETE', '/api/schedules/101'), 404, 'No existe la programación 101')
  })

  it('404 con el mensaje exacto si no existe', async () => {
    esperarError(await pedir('DELETE', '/api/schedules/99999'), 404, 'No existe la programación 99999')
    expect(await semana()).toHaveLength(5)
  })

  it('caso límite 7: id no numérico da 404', async () => {
    esperarError(await pedir('DELETE', '/api/schedules/abc'), 404, 'No existe la programación abc')
  })
})

describe('PUT /api/schedules/{id}/employees', () => {
  beforeEach(() => {
    conProgramacion101()
  })

  it('Reemplazo: [3, 5] pasa a [5, 8]', async () => {
    const respuesta = await pedir('PUT', '/api/schedules/101/employees', { employee_ids: [5, 8] })

    expect(respuesta.status).toBe(200)
    expect({ ...respuesta.cuerpo, employee_ids: ordenados(respuesta.cuerpo.employee_ids) }).toEqual({
      ...PROGRAMACION_101,
      employee_ids: [5, 8],
    })
    expect(ordenados((await buscarProgramacion(101))?.employee_ids ?? [])).toEqual([5, 8])
  })

  it('Conservar un inactivo ya asignado: [9, 5] con [9, 3] da 200 con [9, 3]', async () => {
    conProgramacion101([9, 5])

    const respuesta = await pedir('PUT', '/api/schedules/101/employees', { employee_ids: [9, 3] })

    expect(respuesta.status).toBe(200)
    expect(ordenados(respuesta.cuerpo.employee_ids)).toEqual([3, 9])
    expect(ordenados((await buscarProgramacion(101))?.employee_ids ?? [])).toEqual([3, 9])
  })

  it('Agregar un inactivo: 422 y la asignación no cambia', async () => {
    const respuesta = await pedir('PUT', '/api/schedules/101/employees', { employee_ids: [9] })

    esperarError(respuesta, 422, 'El empleado 9 está inactivo')
    expect(ordenados((await buscarProgramacion(101))?.employee_ids ?? [])).toEqual([3, 5])
  })

  it('un inactivo ya asignado no permite agregar otro inactivo', async () => {
    conProgramacion101([9])

    const respuesta = await pedir('PUT', '/api/schedules/101/employees', { employee_ids: [9, 10] })

    esperarError(respuesta, 422, 'El empleado 10 está inactivo')
    expect((await buscarProgramacion(101))?.employee_ids).toEqual([9])
  })

  it('caso límite 2: con [] deja la programación sin empleados y responde 200', async () => {
    const respuesta = await pedir('PUT', '/api/schedules/101/employees', { employee_ids: [] })

    expect(respuesta.status).toBe(200)
    expect(respuesta.cuerpo.employee_ids).toEqual([])
    expect((await buscarProgramacion(101))?.employee_ids).toEqual([])
  })

  it('ignora los ids repetidos', async () => {
    const respuesta = await pedir('PUT', '/api/schedules/101/employees', { employee_ids: [5, 8, 5, 8] })

    expect(respuesta.status).toBe(200)
    expect(ordenados(respuesta.cuerpo.employee_ids)).toEqual([5, 8])
  })

  it('no cambia la fecha, la hora ni el trabajo', async () => {
    const respuesta = await pedir('PUT', '/api/schedules/101/employees', { employee_ids: [1] })

    expect(respuesta.cuerpo).toMatchObject({ id: 101, job: TRABAJO_7, date: '2026-11-02', start_time: '08:00' })
  })

  it('422 sin cambios cuando un empleado no existe', async () => {
    esperarError(
      await pedir('PUT', '/api/schedules/101/employees', { employee_ids: [5, 999] }),
      422,
      'No existe el empleado 999',
    )
    expect(ordenados((await buscarProgramacion(101))?.employee_ids ?? [])).toEqual([3, 5])
  })

  it.each<[string, unknown]>([
    ['falta employee_ids', {}],
    ['employee_ids no es una lista', { employee_ids: 5 }],
    ['el cuerpo no es JSON', { crudo: '{"employee_ids": [' }],
  ])('422 sin cambios cuando %s', async (_descripcion, cuerpo) => {
    esperarError(
      await pedir('PUT', '/api/schedules/101/employees', cuerpo),
      422,
      'El cuerpo de la petición no es válido',
    )
    expect(ordenados((await buscarProgramacion(101))?.employee_ids ?? [])).toEqual([3, 5])
  })

  it('404 con el mensaje exacto si no existe', async () => {
    esperarError(
      await pedir('PUT', '/api/schedules/99999/employees', { employee_ids: [5] }),
      404,
      'No existe la programación 99999',
    )
  })

  it('caso límite 7: id no numérico da 404', async () => {
    esperarError(
      await pedir('PUT', '/api/schedules/abc/employees', { employee_ids: [5] }),
      404,
      'No existe la programación abc',
    )
  })
})

describe('estado en memoria', () => {
  it('cada createHandlers parte de la semilla sin los cambios de otro', async () => {
    const semilla = createSeed(HOY)
    server.resetHandlers(...createHandlers(semilla))
    await pedir('PUT', '/api/schedules/1/employees', { employee_ids: [8] })
    await pedir('PATCH', '/api/schedules/1', { date: '2026-11-06' })
    await pedir('DELETE', '/api/schedules/2')

    // La semilla original no se modificó.
    expect(semilla.schedules[0]).toMatchObject({ id: 1, date: '2026-11-02', employee_ids: [3, 5] })
    expect(semilla.schedules).toHaveLength(4)

    server.resetHandlers(...createHandlers(semilla))
    const programaciones = await semana()
    expect(programaciones.map((programacion) => programacion.id)).toEqual([1, 2, 3, 4])
    expect(programaciones[0]).toMatchObject({ date: '2026-11-02' })
    expect(ordenados(programaciones[0].employee_ids)).toEqual([3, 5])
  })

  it('los cambios persisten entre peticiones del mismo servidor', async () => {
    const creada = await pedir('POST', '/api/schedules', { job_id: 7, date: '2026-11-05', start_time: '11:00' })
    await pedir('PUT', `/api/schedules/${creada.cuerpo.id}/employees`, { employee_ids: [2] })
    await pedir('PATCH', `/api/schedules/${creada.cuerpo.id}`, { start_time: '12:00' })

    expect(await buscarProgramacion(creada.cuerpo.id)).toEqual({
      id: creada.cuerpo.id,
      job: TRABAJO_7,
      date: '2026-11-05',
      start_time: '12:00',
      employee_ids: [2],
    })
  })
})
