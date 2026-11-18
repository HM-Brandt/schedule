// Tests de las acciones con deshacer (tareas 8.2 y 8.3 de `schedule-assign`): `useScheduleActions`
// y `UndoProvider` con `msw/node`.
//
// Cubren la decisión 6 de `design.md` (tabla de inversas, reasignación de id al deshacer un
// quitar y "si la operación inversa falla, se muestra el error y la entrada vuelve a la pila")
// y, de `specs/weekly-schedule-board/spec.md`, los requisitos "Deshacer" (incluido "Deshacer un
// quitar con un empleado inactivo"), "Duplicar una programación" (la copia lleva solo los
// empleados activos) y "Respuesta inmediata y error al guardar".
//
// Para cada acción se comprueba la entrada que queda en la pila cuando el servidor confirma, que
// no se apila nada si falla, y las peticiones que envía `undo()`.
//
// La semilla para el martes 2026-11-03 programa en la semana del 1 al 7:
// - lunes 2: "J-1024 Pintar oficina" (id 1) a las 07:00 con Ana López (3) y Luis Martínez (5) y
//   el comentario "Llevar escalera", y otra (id 2) a las 08:00 con Ana y sin comentario;
// - martes 3: "J-1019 Cambiar ventanas" (id 3) a las 07:00 con Carlos Ruiz (8);
// - jueves 5: "J-1029 Instalar lámparas" (id 4) a las 09:30, sin empleados.
// Raúl Torres (9) y Lucía Navarro (10) están inactivos. La siguiente programación que cree el
// servidor tendrá el id 5 (o 11 si el test añade la 10).
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import type { ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useEmployees, useWeekSchedules } from '../api/queries'
import { createQueryClient } from '../api/queryClient'
import type { Schedule } from '../api/types'
import { createHandlers } from '../mocks/handlers'
import { createSeed } from '../mocks/seed'
import { UndoProvider, useUndo } from './UndoProvider'
import { useScheduleActions } from './useScheduleActions'

const DOMINGO = '2026-11-01'
const LUNES = '2026-11-02'
const MARTES = '2026-11-03'
const MIERCOLES = '2026-11-04'
const JUEVES = '2026-11-05'
const SABADO = '2026-11-07'

const MENSAJE_500 = 'Fallo simulado del servidor'
const MENSAJE_ERROR = `Couldn't save the change. ${MENSAJE_500}`

/** Raúl Torres, inactivo en la semilla. */
const RAUL = 9

type Peticion = { metodo: string; ruta: string; cuerpo: unknown }

const server = setupServer()

let semilla: ReturnType<typeof createSeed>
let client: QueryClient
let peticiones: Peticion[]

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
})

beforeEach(() => {
  semilla = createSeed(new Date(2026, 10, 3))
  peticiones = []
  client = createQueryClient()
  client.setDefaultOptions({ queries: { retry: false } })
})

afterEach(() => {
  client.clear()
})

afterAll(() => {
  server.close()
})

/**
 * Registra los manejadores de la semilla y, delante, uno que anota cada petición de cambio
 * (POST, PATCH, DELETE, PUT) y la deja pasar a la semilla.
 */
function prepararServidor() {
  const anotar = async ({ request }: { request: Request }) => {
    const texto = await request.clone().text()
    peticiones.push({
      metodo: request.method,
      ruta: new URL(request.url).pathname,
      cuerpo: texto ? JSON.parse(texto) : null,
    })
    return undefined
  }
  server.resetHandlers(
    http.post('/v2/job-management/schedules', anotar),
    http.patch('/v2/job-management/schedules/:id', anotar),
    http.delete('/v2/job-management/schedules/:id', anotar),
    http.put('/v2/job-management/schedules/:id/employees', anotar),
    ...createHandlers(semilla),
  )
}

/** Añade a la semilla, el miércoles a las 07:00, "J-1031 Jardín Pérez" (id 10) con Ana (activa) y Raúl (inactivo). */
function programarConUnInactivo() {
  semilla.schedules.push({
    jobSchedulesId: 10,
    jobsId: semilla.jobs[13].jobsId,
    date: MIERCOLES,
    startTime: '07:00',
    employeesIds: [3, RAUL],
    scheduleComment: null,
  })
}

const error500 = () => HttpResponse.json({ error: MENSAJE_500 }, { status: 500 })

/** Las acciones sobre la semana del 1 al 7 de noviembre y el contexto de deshacer. */
function useArnes() {
  const semana = useWeekSchedules(DOMINGO, SABADO)
  const empleados = useEmployees()
  const programaciones = semana.data ?? []
  return {
    programaciones,
    cargado: !!semana.data && !!empleados.data,
    acciones: useScheduleActions(programaciones),
    deshacer: useUndo(),
  }
}

function envoltorio({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <UndoProvider>{children}</UndoProvider>
    </QueryClientProvider>
  )
}

/** Monta el arnés y espera a que carguen la semana y los empleados. */
async function montar() {
  prepararServidor()
  const vista = renderHook(() => useArnes(), { wrapper: envoltorio })
  await waitFor(() => expect(vista.result.current.cargado).toBe(true))
  return vista.result
}

type Arnes = Awaited<ReturnType<typeof montar>>

const programacion = (arnes: Arnes, id: number) =>
  arnes.current.programaciones.find((item) => item.jobSchedulesId === id) as Schedule

/** Ejecuta `accion` y espera a que el servidor la confirme o la rechace. */
async function ejecutar(accion: () => Promise<unknown>) {
  await act(async () => {
    await accion()
  })
}

/** Pulsa "deshacer" y espera a que terminen sus peticiones. Vacía antes la lista de peticiones. */
async function deshacer(arnes: Arnes) {
  peticiones = []
  await act(async () => {
    await arnes.current.deshacer.undo()
  })
}

describe('useScheduleActions: cada acción apila su inversa al confirmar el servidor', () => {
  it('programar: entrada "Job scheduled" con DELETE de la nueva programación; deshacer la borra', async () => {
    const arnes = await montar()

    await ejecutar(() => arnes.current.acciones.create(semilla.jobs[13], JUEVES))

    expect(peticiones).toEqual([
      { metodo: 'POST', ruta: '/v2/job-management/schedules', cuerpo: { jobsId: 14, date: JUEVES, startTime: '07:00' } },
    ])
    expect(arnes.current.deshacer.stack).toEqual([{ label: 'Job scheduled', ops: [{ kind: 'delete', id: 5 }] }])
    expect(arnes.current.deshacer.toast).toEqual({ message: 'Job scheduled', kind: 'action' })

    await deshacer(arnes)

    expect(peticiones).toEqual([{ metodo: 'DELETE', ruta: '/v2/job-management/schedules/5', cuerpo: null }])
    await waitFor(() => expect(programacion(arnes, 5)).toBeUndefined())
    expect(arnes.current.deshacer.stack).toEqual([])
  })

  it('mover: entrada "Job moved" con PATCH a la fecha y la hora anteriores; deshacer la devuelve al lunes a las 07:00', async () => {
    const arnes = await montar()

    await ejecutar(() => arnes.current.acciones.move(programacion(arnes, 1), JUEVES))

    expect(peticiones).toEqual([
      { metodo: 'PATCH', ruta: '/v2/job-management/schedules/1', cuerpo: { date: JUEVES, startTime: '07:00' } },
    ])
    expect(arnes.current.deshacer.stack).toEqual([
      { label: 'Job moved', ops: [{ kind: 'patch', id: 1, changes: { date: LUNES, startTime: '07:00' } }] },
    ])
    expect(arnes.current.deshacer.toast).toEqual({ message: 'Job moved', kind: 'action' })

    await deshacer(arnes)

    expect(peticiones).toEqual([
      { metodo: 'PATCH', ruta: '/v2/job-management/schedules/1', cuerpo: { date: LUNES, startTime: '07:00' } },
    ])
    await waitFor(() =>
      expect(programacion(arnes, 1)).toMatchObject({ date: LUNES, startTime: '07:00', employeesIds: [3, 5] }),
    )
  })

  it('mover a un día con ese trabajo: la inversa restaura también la hora anterior, no la recalculada', async () => {
    const arnes = await montar()

    // La de las 08:00 pasa al martes, que no tiene "J-1024", y conserva su hora.
    await ejecutar(() => arnes.current.acciones.move(programacion(arnes, 2), MARTES))
    await waitFor(() => expect(programacion(arnes, 2).date).toBe(MARTES))
    // La de las 07:00 va al martes, que ya tiene "J-1024" a las 08:00: queda a las 09:00.
    await ejecutar(() => arnes.current.acciones.move(programacion(arnes, 1), MARTES))

    expect(peticiones.at(-1)).toEqual({
      metodo: 'PATCH',
      ruta: '/v2/job-management/schedules/1',
      cuerpo: { date: MARTES, startTime: '09:00' },
    })
    expect(arnes.current.deshacer.stack.at(-1)?.ops).toEqual([
      { kind: 'patch', id: 1, changes: { date: LUNES, startTime: '07:00' } },
    ])
  })

  it('cambiar la hora: entrada "Start time changed" con PATCH a la fecha y la hora anteriores; deshacer vuelve a 07:00', async () => {
    const arnes = await montar()

    await ejecutar(() => arnes.current.acciones.setStartTime(programacion(arnes, 1), '10:30'))

    expect(peticiones).toEqual([{ metodo: 'PATCH', ruta: '/v2/job-management/schedules/1', cuerpo: { startTime: '10:30' } }])
    expect(arnes.current.deshacer.stack).toEqual([
      { label: 'Start time changed', ops: [{ kind: 'patch', id: 1, changes: { date: LUNES, startTime: '07:00' } }] },
    ])
    expect(arnes.current.deshacer.toast).toEqual({ message: 'Start time changed', kind: 'action' })

    await deshacer(arnes)

    expect(peticiones).toEqual([
      { metodo: 'PATCH', ruta: '/v2/job-management/schedules/1', cuerpo: { date: LUNES, startTime: '07:00' } },
    ])
    await waitFor(() => expect(programacion(arnes, 1).startTime).toBe('07:00'))
  })

  it('duplicar: entrada "Job duplicated" con DELETE de la copia; deshacer borra la copia y deja la original', async () => {
    const arnes = await montar()

    await ejecutar(() => arnes.current.acciones.duplicate(programacion(arnes, 1), LUNES))

    expect(peticiones).toEqual([
      {
        metodo: 'POST',
        ruta: '/v2/job-management/schedules',
        cuerpo: { jobsId: 7, date: LUNES, startTime: '09:00', employeesIds: [3, 5] },
      },
    ])
    expect(arnes.current.deshacer.stack).toEqual([{ label: 'Job duplicated', ops: [{ kind: 'delete', id: 5 }] }])
    expect(arnes.current.deshacer.toast).toEqual({ message: 'Job duplicated', kind: 'action' })

    await deshacer(arnes)

    expect(peticiones).toEqual([{ metodo: 'DELETE', ruta: '/v2/job-management/schedules/5', cuerpo: null }])
    await waitFor(() => expect(programacion(arnes, 5)).toBeUndefined())
    expect(programacion(arnes, 1)).toMatchObject({ date: LUNES, startTime: '07:00', employeesIds: [3, 5] })
  })

  it('quitar: entrada "Job removed" con POST del mismo trabajo, fecha, hora, empleados y comentario; deshacer la vuelve a crear', async () => {
    const arnes = await montar()
    const pintar = programacion(arnes, 1)

    await ejecutar(() => arnes.current.acciones.remove(pintar))

    expect(peticiones).toEqual([{ metodo: 'DELETE', ruta: '/v2/job-management/schedules/1', cuerpo: null }])
    expect(arnes.current.deshacer.stack).toEqual([
      {
        label: 'Job removed',
        ops: [
          {
            kind: 'create',
            job: pintar.job,
            date: LUNES,
            startTime: '07:00',
            employeesIds: [3, 5],
            scheduleComment: 'Llevar escalera',
            replacesId: 1,
          },
        ],
      },
    ])
    expect(arnes.current.deshacer.toast).toEqual({ message: 'Job removed', kind: 'action' })

    await deshacer(arnes)

    expect(peticiones).toEqual([
      {
        metodo: 'POST',
        ruta: '/v2/job-management/schedules',
        cuerpo: { jobsId: 7, date: LUNES, startTime: '07:00', employeesIds: [3, 5], scheduleComment: 'Llevar escalera' },
      },
    ])
    await waitFor(() =>
      expect(programacion(arnes, 5)).toMatchObject({
        job: pintar.job,
        date: LUNES,
        startTime: '07:00',
        employeesIds: [3, 5],
        scheduleComment: 'Llevar escalera',
      }),
    )
  })

  it('cambiar empleados: entrada "Employees updated" con PUT del conjunto anterior; deshacer lo restaura', async () => {
    const arnes = await montar()

    await ejecutar(() => arnes.current.acciones.setEmployees(programacion(arnes, 1), [3]))

    expect(peticiones).toEqual([
      { metodo: 'PUT', ruta: '/v2/job-management/schedules/1/employees', cuerpo: { employeesIds: [3] } },
    ])
    expect(arnes.current.deshacer.stack).toEqual([
      { label: 'Employees updated', ops: [{ kind: 'put', id: 1, employeesIds: [3, 5] }] },
    ])
    expect(arnes.current.deshacer.toast).toEqual({ message: 'Employees updated', kind: 'action' })

    await deshacer(arnes)

    expect(peticiones).toEqual([
      { metodo: 'PUT', ruta: '/v2/job-management/schedules/1/employees', cuerpo: { employeesIds: [3, 5] } },
    ])
    await waitFor(() => expect(programacion(arnes, 1).employeesIds).toEqual([3, 5]))
  })

  it('mover un empleado: una sola entrada "Employee moved" con los dos PUT anteriores; deshacer envía ambos', async () => {
    const arnes = await montar()

    await ejecutar(() =>
      arnes.current.acciones.transferEmployee(5, programacion(arnes, 1), programacion(arnes, 3)),
    )

    expect(peticiones).toHaveLength(2)
    expect(peticiones).toEqual(
      expect.arrayContaining([
        { metodo: 'PUT', ruta: '/v2/job-management/schedules/1/employees', cuerpo: { employeesIds: [3] } },
        { metodo: 'PUT', ruta: '/v2/job-management/schedules/3/employees', cuerpo: { employeesIds: [8, 5] } },
      ]),
    )
    expect(arnes.current.deshacer.stack).toEqual([
      {
        label: 'Employee moved',
        ops: [
          { kind: 'put', id: 1, employeesIds: [3, 5] },
          { kind: 'put', id: 3, employeesIds: [8] },
        ],
      },
    ])
    expect(arnes.current.deshacer.toast).toEqual({ message: 'Employee moved', kind: 'action' })

    await deshacer(arnes)

    expect(peticiones).toHaveLength(2)
    expect(peticiones).toEqual(
      expect.arrayContaining([
        { metodo: 'PUT', ruta: '/v2/job-management/schedules/1/employees', cuerpo: { employeesIds: [3, 5] } },
        { metodo: 'PUT', ruta: '/v2/job-management/schedules/3/employees', cuerpo: { employeesIds: [8] } },
      ]),
    )
    await waitFor(() => expect(programacion(arnes, 1).employeesIds).toEqual([3, 5]))
    expect(programacion(arnes, 3).employeesIds).toEqual([8])
    expect(arnes.current.deshacer.stack).toEqual([])
  })
})

describe('useScheduleActions: si el servidor rechaza la acción no se apila nada y se muestra el error', () => {
  type Caso = {
    accion: string
    rechazar: () => void
    ejecutar: (arnes: Arnes) => Promise<unknown>
  }
  const casos: Caso[] = [
    {
      accion: 'programar',
      rechazar: () => server.use(http.post('/v2/job-management/schedules', error500)),
      ejecutar: (arnes) => arnes.current.acciones.create(semilla.jobs[13], JUEVES),
    },
    {
      accion: 'mover',
      rechazar: () => server.use(http.patch('/v2/job-management/schedules/:id', error500)),
      ejecutar: (arnes) => arnes.current.acciones.move(programacion(arnes, 1), JUEVES),
    },
    {
      accion: 'cambiar la hora',
      rechazar: () => server.use(http.patch('/v2/job-management/schedules/:id', error500)),
      ejecutar: (arnes) => arnes.current.acciones.setStartTime(programacion(arnes, 1), '10:30'),
    },
    {
      accion: 'cambiar el comentario',
      rechazar: () => server.use(http.patch('/v2/job-management/schedules/:id', error500)),
      ejecutar: async (arnes) => arnes.current.acciones.setComment(programacion(arnes, 1), 'Llevar andamio'),
    },
    {
      accion: 'duplicar',
      rechazar: () => server.use(http.post('/v2/job-management/schedules', error500)),
      ejecutar: (arnes) => arnes.current.acciones.duplicate(programacion(arnes, 1), LUNES),
    },
    {
      accion: 'quitar',
      rechazar: () => server.use(http.delete('/v2/job-management/schedules/:id', error500)),
      ejecutar: (arnes) => arnes.current.acciones.remove(programacion(arnes, 1)),
    },
    {
      accion: 'cambiar empleados',
      rechazar: () => server.use(http.put('/v2/job-management/schedules/:id/employees', error500)),
      ejecutar: (arnes) => arnes.current.acciones.setEmployees(programacion(arnes, 1), [3]),
    },
    {
      accion: 'mover un empleado',
      rechazar: () => server.use(http.put('/v2/job-management/schedules/:id/employees', error500)),
      ejecutar: (arnes) => arnes.current.acciones.transferEmployee(5, programacion(arnes, 1), programacion(arnes, 3)),
    },
  ]

  it.each(casos)('$accion', async ({ rechazar, ejecutar: lanzar }) => {
    const arnes = await montar()
    const antes = structuredClone(arnes.current.programaciones)
    rechazar()

    await ejecutar(() => lanzar(arnes))

    expect(arnes.current.deshacer.stack).toEqual([])
    expect(arnes.current.deshacer.toast).toEqual({ message: MENSAJE_ERROR, kind: 'error' })
    // La reversión deja la semana como estaba.
    await waitFor(() => expect(arnes.current.programaciones).toEqual(antes))
  })

  it('un fallo no borra las entradas que ya había en la pila', async () => {
    const arnes = await montar()
    await ejecutar(() => arnes.current.acciones.setStartTime(programacion(arnes, 1), '10:30'))
    server.use(http.delete('/v2/job-management/schedules/:id', error500))

    await ejecutar(() => arnes.current.acciones.remove(programacion(arnes, 4)))

    expect(arnes.current.deshacer.stack.map((entrada) => entrada.label)).toEqual(['Start time changed'])
  })
})

describe('comentario (tareas 12.2 y 12.3)', () => {
  // La programación 1 de la semilla tiene el comentario "Llevar escalera"; la 2, ninguno.

  it('agregar un comentario: PATCH con scheduleComment, aviso "Comment updated" e inversa con el comentario anterior (null)', async () => {
    const arnes = await montar()

    await ejecutar(async () => arnes.current.acciones.setComment(programacion(arnes, 2), 'Llevar escalera'))

    expect(peticiones).toEqual([
      { metodo: 'PATCH', ruta: '/v2/job-management/schedules/2', cuerpo: { scheduleComment: 'Llevar escalera' } },
    ])
    expect(arnes.current.deshacer.stack).toEqual([
      { label: 'Comment updated', ops: [{ kind: 'patch', id: 2, changes: { scheduleComment: null } }] },
    ])
    expect(arnes.current.deshacer.toast).toEqual({ message: 'Comment updated', kind: 'action' })
    await waitFor(() => expect(programacion(arnes, 2).scheduleComment).toBe('Llevar escalera'))
  })

  it('conserva el texto tal cual, con sus saltos de línea', async () => {
    const arnes = await montar()

    await ejecutar(async () => arnes.current.acciones.setComment(programacion(arnes, 2), 'Llevar escalera\nY rodillos'))

    expect(peticiones).toEqual([
      { metodo: 'PATCH', ruta: '/v2/job-management/schedules/2', cuerpo: { scheduleComment: 'Llevar escalera\nY rodillos' } },
    ])
  })

  it.each([
    ['vacío', ''],
    ['solo espacios', '   '],
    ['solo saltos de línea', '\n \n'],
  ])('borrar el comentario: con el texto %s envía scheduleComment null', async (_descripcion, texto) => {
    const arnes = await montar()

    await ejecutar(async () => arnes.current.acciones.setComment(programacion(arnes, 1), texto))

    expect(peticiones).toEqual([{ metodo: 'PATCH', ruta: '/v2/job-management/schedules/1', cuerpo: { scheduleComment: null } }])
    expect(arnes.current.deshacer.stack).toEqual([
      { label: 'Comment updated', ops: [{ kind: 'patch', id: 1, changes: { scheduleComment: 'Llevar escalera' } }] },
    ])
    await waitFor(() => expect(programacion(arnes, 1).scheduleComment).toBeNull())
  })

  it.each<[string, number, string]>([
    ['el mismo comentario', 1, 'Llevar escalera'],
    ['vacío en una programación sin comentario', 2, ''],
    ['solo espacios en una programación sin comentario', 2, '   '],
  ])('sin cambios (%s): no envía nada ni apila nada', async (_descripcion, id, texto) => {
    const arnes = await montar()

    await ejecutar(async () => arnes.current.acciones.setComment(programacion(arnes, id), texto))

    expect(peticiones).toEqual([])
    expect(arnes.current.deshacer.stack).toEqual([])
    expect(arnes.current.deshacer.toast).toBeNull()
  })

  it('escenario "Deshacer un cambio de comentario": de "Llevar escalera" a "Llevar andamio" y deshacer vuelve a "Llevar escalera"', async () => {
    const arnes = await montar()
    await ejecutar(async () => arnes.current.acciones.setComment(programacion(arnes, 1), 'Llevar andamio'))
    await waitFor(() => expect(programacion(arnes, 1).scheduleComment).toBe('Llevar andamio'))

    await deshacer(arnes)

    expect(peticiones).toEqual([
      { metodo: 'PATCH', ruta: '/v2/job-management/schedules/1', cuerpo: { scheduleComment: 'Llevar escalera' } },
    ])
    await waitFor(() => expect(programacion(arnes, 1).scheduleComment).toBe('Llevar escalera'))
    expect(programacion(arnes, 1)).toMatchObject({ date: LUNES, startTime: '07:00', employeesIds: [3, 5] })
    expect(arnes.current.deshacer.stack).toEqual([])
  })

  it('deshacer el borrado de un comentario lo vuelve a poner', async () => {
    const arnes = await montar()
    await ejecutar(async () => arnes.current.acciones.setComment(programacion(arnes, 1), ''))
    await waitFor(() => expect(programacion(arnes, 1).scheduleComment).toBeNull())

    await deshacer(arnes)

    await waitFor(() => expect(programacion(arnes, 1).scheduleComment).toBe('Llevar escalera'))
  })

  it('deshacer un quitar de una programación con comentario la recrea con ese comentario', async () => {
    const arnes = await montar()
    await ejecutar(() => arnes.current.acciones.remove(programacion(arnes, 1)))
    await waitFor(() => expect(programacion(arnes, 1)).toBeUndefined())

    await deshacer(arnes)

    expect(peticiones).toEqual([
      expect.objectContaining({ metodo: 'POST', cuerpo: expect.objectContaining({ scheduleComment: 'Llevar escalera' }) }),
    ])
    await waitFor(() => expect(programacion(arnes, 5)?.scheduleComment).toBe('Llevar escalera'))
  })

  it('escenario "Duplicar no copia el comentario": la copia no tiene comentario y la original conserva "Llevar escalera"', async () => {
    const arnes = await montar()

    await ejecutar(() => arnes.current.acciones.duplicate(programacion(arnes, 1), LUNES))

    expect(peticiones).toHaveLength(1)
    expect(peticiones[0].cuerpo).not.toHaveProperty('scheduleComment')
    await waitFor(() => expect(programacion(arnes, 5)).toBeDefined())
    expect(programacion(arnes, 5).scheduleComment).toBeNull()
    expect(programacion(arnes, 1).scheduleComment).toBe('Llevar escalera')
  })
})

describe('UndoProvider: undo()', () => {
  it('con la pila vacía no envía nada', async () => {
    const arnes = await montar()

    await deshacer(arnes)

    expect(peticiones).toEqual([])
    expect(arnes.current.deshacer.stack).toEqual([])
  })

  it('cierra el aviso de la acción', async () => {
    const arnes = await montar()
    await ejecutar(() => arnes.current.acciones.move(programacion(arnes, 1), JUEVES))
    expect(arnes.current.deshacer.toast).not.toBeNull()

    await deshacer(arnes)

    expect(arnes.current.deshacer.toast).toBeNull()
  })

  it('deshace en orden inverso a las acciones: primero la última', async () => {
    const arnes = await montar()
    await ejecutar(() => arnes.current.acciones.move(programacion(arnes, 4), SABADO))
    await ejecutar(() => arnes.current.acciones.setEmployees(programacion(arnes, 3), []))

    await deshacer(arnes)
    expect(peticiones).toEqual([
      { metodo: 'PUT', ruta: '/v2/job-management/schedules/3/employees', cuerpo: { employeesIds: [8] } },
    ])

    await deshacer(arnes)
    expect(peticiones).toEqual([
      { metodo: 'PATCH', ruta: '/v2/job-management/schedules/4', cuerpo: { date: JUEVES, startTime: '09:30' } },
    ])
    expect(arnes.current.deshacer.stack).toEqual([])
  })

  it('deshacer un quitar reasigna el id nuevo en las entradas anteriores de esa programación', async () => {
    const arnes = await montar()
    // 1) Una acción sobre otra programación, que no debe cambiar.
    await ejecutar(() => arnes.current.acciones.move(programacion(arnes, 4), SABADO))
    // 2) Cambiar la hora a 10:30 (inversa: PATCH de la programación 1).
    await ejecutar(() => arnes.current.acciones.setStartTime(programacion(arnes, 1), '10:30'))
    await waitFor(() => expect(programacion(arnes, 1).startTime).toBe('10:30'))
    // 3) Quitar a Ana de la programación 1 (inversa: PUT de la programación 1).
    await ejecutar(() => arnes.current.acciones.setEmployees(programacion(arnes, 1), [5]))
    await waitFor(() => expect(programacion(arnes, 1).employeesIds).toEqual([5]))
    // 4) Quitar la programación 1.
    await ejecutar(() => arnes.current.acciones.remove(programacion(arnes, 1)))

    // Se deshace el quitar: el servidor la crea de nuevo con el id 5.
    await deshacer(arnes)

    expect(peticiones).toEqual([
      {
        metodo: 'POST',
        ruta: '/v2/job-management/schedules',
        cuerpo: { jobsId: 7, date: LUNES, startTime: '10:30', employeesIds: [5], scheduleComment: 'Llevar escalera' },
      },
    ])
    expect(arnes.current.deshacer.stack).toEqual([
      { label: 'Job moved', ops: [{ kind: 'patch', id: 4, changes: { date: JUEVES, startTime: '09:30' } }] },
      { label: 'Start time changed', ops: [{ kind: 'patch', id: 5, changes: { date: LUNES, startTime: '07:00' } }] },
      { label: 'Employees updated', ops: [{ kind: 'put', id: 5, employeesIds: [3, 5] }] },
    ])

    // Las inversas siguientes van ya a la programación nueva.
    await waitFor(() => expect(programacion(arnes, 5)).toBeDefined())
    await deshacer(arnes)
    expect(peticiones).toEqual([
      { metodo: 'PUT', ruta: '/v2/job-management/schedules/5/employees', cuerpo: { employeesIds: [3, 5] } },
    ])
    await deshacer(arnes)
    expect(peticiones).toEqual([
      { metodo: 'PATCH', ruta: '/v2/job-management/schedules/5', cuerpo: { date: LUNES, startTime: '07:00' } },
    ])
    await waitFor(() =>
      expect(programacion(arnes, 5)).toMatchObject({ date: LUNES, startTime: '07:00', employeesIds: [3, 5] }),
    )
    await deshacer(arnes)
    expect(peticiones).toEqual([
      { metodo: 'PATCH', ruta: '/v2/job-management/schedules/4', cuerpo: { date: JUEVES, startTime: '09:30' } },
    ])
    expect(arnes.current.deshacer.stack).toEqual([])
  })

  it('si la inversa falla, la entrada vuelve a la pila, se muestra el error y se puede volver a deshacer', async () => {
    const arnes = await montar()
    await ejecutar(() => arnes.current.acciones.move(programacion(arnes, 1), JUEVES))
    const entrada = arnes.current.deshacer.stack[0]
    server.use(http.patch('/v2/job-management/schedules/:id', error500, { once: true }))

    await deshacer(arnes)

    expect(arnes.current.deshacer.stack).toEqual([entrada])
    expect(arnes.current.deshacer.toast).toEqual({ message: MENSAJE_ERROR, kind: 'error' })
    await waitFor(() => expect(programacion(arnes, 1).date).toBe(JUEVES))

    await deshacer(arnes)

    expect(peticiones).toEqual([
      { metodo: 'PATCH', ruta: '/v2/job-management/schedules/1', cuerpo: { date: LUNES, startTime: '07:00' } },
    ])
    expect(arnes.current.deshacer.stack).toEqual([])
    await waitFor(() => expect(programacion(arnes, 1).date).toBe(LUNES))
  })

  it('si falla la inversa de un quitar, la entrada vuelve a la pila sin reasignar ids', async () => {
    const arnes = await montar()
    await ejecutar(() => arnes.current.acciones.setStartTime(programacion(arnes, 1), '10:30'))
    await waitFor(() => expect(programacion(arnes, 1).startTime).toBe('10:30'))
    await ejecutar(() => arnes.current.acciones.remove(programacion(arnes, 1)))
    const pila = arnes.current.deshacer.stack
    server.use(http.post('/v2/job-management/schedules', error500, { once: true }))

    await deshacer(arnes)

    expect(arnes.current.deshacer.stack).toEqual(pila)
    expect(arnes.current.deshacer.toast).toEqual({ message: MENSAJE_ERROR, kind: 'error' })
  })
})

describe('empleados inactivos', () => {
  it('duplicar copia solo los empleados activos: Ana sí y Raúl no', async () => {
    programarConUnInactivo()
    const arnes = await montar()

    await ejecutar(() => arnes.current.acciones.duplicate(programacion(arnes, 10), JUEVES))

    expect(peticiones).toEqual([
      {
        metodo: 'POST',
        ruta: '/v2/job-management/schedules',
        cuerpo: { jobsId: 14, date: JUEVES, startTime: '07:00', employeesIds: [3] },
      },
    ])
    expect(arnes.current.deshacer.stack).toEqual([{ label: 'Job duplicated', ops: [{ kind: 'delete', id: 11 }] }])
    await waitFor(() => expect(programacion(arnes, 11).employeesIds).toEqual([3]))
  })

  it('escenario "Deshacer un quitar con un empleado inactivo": vuelve con Ana y sin Raúl', async () => {
    programarConUnInactivo()
    const arnes = await montar()
    await ejecutar(() => arnes.current.acciones.remove(programacion(arnes, 10)))
    // La inversa guarda los empleados tal como estaban; el filtrado se hace al ejecutarla.
    expect(arnes.current.deshacer.stack[0].ops[0]).toMatchObject({ kind: 'create', employeesIds: [3, RAUL] })

    await deshacer(arnes)

    expect(peticiones).toEqual([
      {
        metodo: 'POST',
        ruta: '/v2/job-management/schedules',
        cuerpo: { jobsId: 14, date: MIERCOLES, startTime: '07:00', employeesIds: [3], scheduleComment: null },
      },
    ])
    expect(arnes.current.deshacer.toast).toBeNull()
    await waitFor(() =>
      expect(programacion(arnes, 11)).toMatchObject({ date: MIERCOLES, startTime: '07:00', employeesIds: [3] }),
    )
  })

  it('la inversa PUT no vuelve a asignar a un inactivo que ya no está en la programación', async () => {
    programarConUnInactivo()
    const arnes = await montar()
    // Se retira a Raúl: la inversa guarda [3, 9].
    await ejecutar(() => arnes.current.acciones.setEmployees(programacion(arnes, 10), [3]))
    await waitFor(() => expect(programacion(arnes, 10).employeesIds).toEqual([3]))

    await deshacer(arnes)

    expect(peticiones).toEqual([
      { metodo: 'PUT', ruta: '/v2/job-management/schedules/10/employees', cuerpo: { employeesIds: [3] } },
    ])
    expect(arnes.current.deshacer.toast).toBeNull()
    await waitFor(() => expect(programacion(arnes, 10).employeesIds).toEqual([3]))
  })

  it('la inversa PUT mantiene a un inactivo que sigue asignado', async () => {
    programarConUnInactivo()
    const arnes = await montar()
    // Se retira a Ana; Raúl sigue en la programación. La inversa guarda [3, 9].
    await ejecutar(() => arnes.current.acciones.setEmployees(programacion(arnes, 10), [RAUL]))
    await waitFor(() => expect(programacion(arnes, 10).employeesIds).toEqual([RAUL]))

    await deshacer(arnes)

    expect(peticiones).toEqual([
      { metodo: 'PUT', ruta: '/v2/job-management/schedules/10/employees', cuerpo: { employeesIds: [3, RAUL] } },
    ])
    await waitFor(() => expect(programacion(arnes, 10).employeesIds).toEqual([3, RAUL]))
  })
})
