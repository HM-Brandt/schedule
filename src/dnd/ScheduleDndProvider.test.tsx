// Tests del despacho al soltar de `ScheduleDndProvider` (tareas 6.3, 6.4, 7.2 y 7.3 de
// `schedule-assign`) con `msw/node`.
//
// Cubren de `specs/weekly-schedule-board/spec.md` los requisitos "Mover una programación a
// otro día", "Duplicar una programación" (escenario "Duplicar con Alt en otro día") y "Quitar
// una programación" (escenario "Arrastrar de vuelta al catálogo"); de
// `specs/employee-assignment/spec.md`, "Asignar un empleado arrastrándolo", "Sin asignaciones
// repetidas en una programación", "Varios trabajos por empleado en el mismo día", "Mover un
// empleado entre programaciones" y "Retirar un empleado de una programación"; y la decisión 5
// de `design.md`. Para cada acción se comprueba la petición que llega al servidor (método,
// ruta y cuerpo) y cómo queda el tablero.
//
// Se monta el proveedor real, dentro de `UndoProvider` (las acciones apilan su inversa), con el catálogo, las siete columnas de la semana y el panel de
// empleados, y el arrastre se maneja con las acciones del gestor de @dnd-kit (ver
// `src/test/dnd.ts`). Los orígenes son `employee-{id}` (empleado del panel) y
// `employee-{id}-in-{programación}` (chip de una tarjeta); los destinos, `card-{programación}`.
//
// La fecha del sistema se fija en el martes 2026-11-03. La semilla programa esa semana:
// - lunes 2: "J-1024 Pintar oficina" (id 1) a las 07:00 con Ana López (3) y Luis Martínez (5),
//   y otra (id 2) a las 08:00 con Ana;
// - martes 3: "J-1019 Cambiar ventanas" (id 3) a las 07:00 con Carlos Ruiz (8);
// - jueves 5: "J-1029 Instalar lámparas" (id 4) a las 09:30, sin empleados.
//
// El panel de empleados solo muestra a los activos con cargo "Supervisor" o "Labor" (commit
// 7a084c0). En la semilla Luis tiene cargo "Office"; `beforeEach` le da cargo "Labor" para poder
// arrastrarlo desde el panel y ver sus recuadros.
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import { http } from 'msw'
import { setupServer } from 'msw/node'
import { useMemo } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEmployees, useWeekAbsences, useWeekSchedules } from '../api/queries'
import { createQueryClient } from '../api/queryClient'
import { WeekBoard } from '../board/WeekBoard'
import { JobCatalog } from '../catalog/JobCatalog'
import { EmployeePanel } from '../employees/EmployeePanel'
import { absencesByDay, schedulesByDay } from '../lib/selectors'
import { createHandlers } from '../mocks/handlers'
import { createSeed } from '../mocks/seed'
import { CapturadorDelGestor, arrastrar, simularApisDeArrastre } from '../test/dnd'
import { UndoProvider } from '../undo/UndoProvider'
import { ScheduleDndProvider } from './ScheduleDndProvider'

simularApisDeArrastre()

const DIAS = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']
const LUNES = '2026-11-02'
const MARTES = '2026-11-03'
const VIERNES = '2026-11-06'
const SABADO = '2026-11-07'

type Peticion = { metodo: string; ruta: string; cuerpo: unknown }

const server = setupServer()

let semilla: ReturnType<typeof createSeed>
let client: QueryClient
let peticiones: Peticion[]

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 3, 10, 0))
  semilla = createSeed(new Date(2026, 10, 3))
  semilla.employees = semilla.employees.map((empleado) =>
    empleado.firstName === 'Luis' ? { ...empleado, title: 'Labor' } : empleado,
  )
  peticiones = []
  client = createQueryClient()
  client.setDefaultOptions({ queries: { retry: false } })
})

afterEach(() => {
  client.clear()
  vi.useRealTimers()
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

/** El catálogo y el tablero de la semana del 1 al 7 de noviembre dentro del proveedor de arrastre. */
function Tablero() {
  const schedules = useWeekSchedules(DIAS[0], DIAS[6])
  const employees = useEmployees()
  const employeesById = useMemo(
    () => new Map((employees.data ?? []).map((employee) => [employee.employeesId, employee])),
    [employees.data],
  )
  const absences = useWeekAbsences(DIAS[0], DIAS[6])
  const byDay = useMemo(() => schedulesByDay(schedules.data ?? [], DIAS), [schedules.data])
  const absencesOfDay = useMemo(() => absencesByDay(absences.data ?? [], DIAS), [absences.data])

  return (
    <ScheduleDndProvider schedules={schedules.data ?? []} absences={absences.data ?? []}>
      <CapturadorDelGestor />
      <JobCatalog counts={new Map()} />
      <WeekBoard
        days={DIAS}
        today={MARTES}
        schedulesByDay={byDay}
        absencesByDay={absencesOfDay}
        employeesById={employeesById}
      />
      <EmployeePanel
        employees={employees.data ?? []}
        error={employees.error}
        schedules={schedules.data ?? []}
        absences={absences.data ?? []}
        days={DIAS}
        today={MARTES}
        hours={undefined}
      />
    </ScheduleDndProvider>
  )
}

/** Monta el tablero y espera a que estén cargadas las `total` programaciones de la semilla y los empleados. */
async function renderTablero(total = 4) {
  prepararServidor()
  render(
    <QueryClientProvider client={client}>
      <UndoProvider>
        <Tablero />
      </UndoProvider>
    </QueryClientProvider>,
  )
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(total))
  await waitFor(() => expect(screen.getAllByTitle('Ana López')).toHaveLength(2))
}

/** Columna del día con nombre abreviado `nombre` ("Mon"): su encabezado y sus tarjetas. */
function columnaDelDia(nombre: string): HTMLElement {
  const encabezado = screen.getByText(nombre).parentElement as HTMLElement
  return encabezado.parentElement as HTMLElement
}

const tarjetasDelDia = (nombre: string) => within(columnaDelDia(nombre)).queryAllByRole('article')

/** Iniciales de los empleados de una tarjeta, en orden. */
const iniciales = (tarjeta: HTMLElement) =>
  Array.from(tarjeta.querySelectorAll('span[title]:not([aria-label^="Comment:"])')).map((elemento) => elemento.textContent)

/** Comprueba que soltar no envió ninguna petición de cambio. */
async function sinPeticiones() {
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(peticiones).toEqual([])
}

describe('ScheduleDndProvider', () => {
  describe('mover una tarjeta a otro día', () => {
    it('a un día sin ese trabajo: PATCH con la nueva fecha y la misma hora 07:00, y conserva a Ana y Luis', async () => {
      await renderTablero()

      await arrastrar('schedule-1', `day-${MARTES}`)

      await waitFor(() =>
        expect(peticiones).toEqual([
          { metodo: 'PATCH', ruta: '/v2/job-management/schedules/1', cuerpo: { date: MARTES, startTime: '07:00' } },
        ]),
      )
      await waitFor(() => expect(tarjetasDelDia('Tue')).toHaveLength(2))
      const movida = tarjetasDelDia('Tue').find((tarjeta) => tarjeta.textContent?.includes('J-1024'))
      expect(movida).toHaveTextContent('07:00')
      expect(iniciales(movida!)).toEqual(['AL', 'LM'])
      expect(tarjetasDelDia('Mon')).toHaveLength(1)
      expect(tarjetasDelDia('Mon')[0]).toHaveTextContent('08:00')
    })

    it('conserva también una hora que no es en punto: 09:30 del jueves al sábado', async () => {
      await renderTablero()

      await arrastrar('schedule-4', `day-${SABADO}`)

      await waitFor(() =>
        expect(peticiones).toEqual([
          { metodo: 'PATCH', ruta: '/v2/job-management/schedules/4', cuerpo: { date: SABADO, startTime: '09:30' } },
        ]),
      )
      await waitFor(() => expect(tarjetasDelDia('Sat')).toHaveLength(1))
      expect(tarjetasDelDia('Sat')[0]).toHaveTextContent('09:30')
      expect(tarjetasDelDia('Thu')).toHaveLength(0)
    })

    it('a un día que ya tiene ese trabajo a las 07:00: PATCH con la hora recalculada 08:00', async () => {
      semilla.schedules.push({ jobSchedulesId: 10, jobsId: semilla.jobs[6].jobsId, date: MARTES, startTime: '07:00', employeesIds: [], scheduleComment: null })
      await renderTablero(5)
      expect(tarjetasDelDia('Tue')).toHaveLength(2)

      await arrastrar('schedule-1', `day-${MARTES}`)

      await waitFor(() =>
        expect(peticiones).toEqual([
          { metodo: 'PATCH', ruta: '/v2/job-management/schedules/1', cuerpo: { date: MARTES, startTime: '08:00' } },
        ]),
      )
      await waitFor(() => expect(tarjetasDelDia('Tue')).toHaveLength(3))
      const pintar = tarjetasDelDia('Tue').filter((tarjeta) => tarjeta.textContent?.includes('J-1024'))
      expect(pintar.map((tarjeta) => tarjeta.textContent?.match(/\d{2}:\d{2}/)?.[0])).toEqual(['07:00', '08:00'])
      expect(iniciales(pintar[1])).toEqual(['AL', 'LM'])
    })

    it('a su mismo día sin Alt: no envía nada y la tarjeta se queda', async () => {
      await renderTablero()

      await arrastrar('schedule-1', `day-${LUNES}`)

      await sinPeticiones()
      expect(tarjetasDelDia('Mon')).toHaveLength(2)
    })

    it('soltada fuera de cualquier destino: no envía nada', async () => {
      await renderTablero()

      await arrastrar('schedule-1', null)

      await sinPeticiones()
      expect(tarjetasDelDia('Mon')).toHaveLength(2)
    })

    it('con el arrastre cancelado sobre otro día: no envía nada', async () => {
      await renderTablero()

      await arrastrar('schedule-1', `day-${MARTES}`, { cancelado: true })

      await sinPeticiones()
      expect(tarjetasDelDia('Mon')).toHaveLength(2)
      expect(tarjetasDelDia('Tue')).toHaveLength(1)
    })
  })

  describe('duplicar con Alt', () => {
    it('del lunes al viernes: POST con el mismo trabajo, Ana y Luis y la hora por defecto 07:00; el lunes conserva la suya', async () => {
      await renderTablero()

      await arrastrar('schedule-1', `day-${VIERNES}`, { altKey: true })

      await waitFor(() =>
        expect(peticiones).toEqual([
          {
            metodo: 'POST',
            ruta: '/v2/job-management/schedules',
            cuerpo: { jobsId: 7, date: VIERNES, startTime: '07:00', employeesIds: [3, 5] },
          },
        ]),
      )
      await waitFor(() => expect(tarjetasDelDia('Fri')).toHaveLength(1))
      const copia = tarjetasDelDia('Fri')[0]
      expect(copia).toHaveTextContent('J-1024')
      expect(copia).toHaveTextContent('Pintar oficina')
      expect(copia).toHaveTextContent('07:00')
      expect(iniciales(copia)).toEqual(['AL', 'LM'])
      expect(tarjetasDelDia('Mon')).toHaveLength(2)
      expect(iniciales(tarjetasDelDia('Mon')[0])).toEqual(['AL', 'LM'])
    })

    it('copia los empleados de la tarjeta arrastrada, no los de otra del mismo trabajo', async () => {
      await renderTablero()

      await arrastrar('schedule-2', `day-${VIERNES}`, { altKey: true })

      await waitFor(() => expect(peticiones).toHaveLength(1))
      expect(peticiones[0].cuerpo).toEqual({ jobsId: 7, date: VIERNES, startTime: '07:00', employeesIds: [3] })
    })

    it('una tarjeta sin empleados: la copia se envía con la lista vacía', async () => {
      await renderTablero()

      await arrastrar('schedule-4', `day-${VIERNES}`, { altKey: true })

      await waitFor(() => expect(peticiones).toHaveLength(1))
      expect(peticiones[0]).toEqual({
        metodo: 'POST',
        ruta: '/v2/job-management/schedules',
        cuerpo: { jobsId: 12, date: VIERNES, startTime: '07:00', employeesIds: [] },
      })
    })

    // Tarea 5.2 de `employee-absences`: requisito "Duplicar a un día con empleados ausentes".
    it('escenario "Duplicar con Luis ausente el viernes": el POST solo lleva a Ana y la copia del viernes muestra solo a Ana', async () => {
      semilla.absences.push({
        employeeAbsencesId: 2,
        employeesId: 5,
        date: VIERNES,
        absenceType: 'Sick',
        absenceComment: null,
      })
      await renderTablero()
      await waitFor(() => expect(within(columnaDelDia('Fri')).getByText('Luis Martínez')).toBeInTheDocument())

      await arrastrar('schedule-1', `day-${VIERNES}`, { altKey: true })

      await waitFor(() =>
        expect(peticiones).toEqual([
          {
            metodo: 'POST',
            ruta: '/v2/job-management/schedules',
            cuerpo: { jobsId: 7, date: VIERNES, startTime: '07:00', employeesIds: [3] },
          },
        ]),
      )
      await waitFor(() => expect(tarjetasDelDia('Fri')).toHaveLength(1))
      const copia = tarjetasDelDia('Fri')[0]
      expect(copia).toHaveTextContent('J-1024')
      expect(iniciales(copia)).toEqual(['AL'])
      // La original del lunes conserva a Ana y Luis.
      expect(iniciales(tarjetasDelDia('Mon')[0])).toEqual(['AL', 'LM'])
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('si la ausente el viernes es otra persona que no está en la tarjeta, la copia lleva a Ana y Luis', async () => {
      semilla.absences.push({
        employeeAbsencesId: 2,
        employeesId: 8,
        date: VIERNES,
        absenceType: 'Off',
        absenceComment: null,
      })
      await renderTablero()
      await waitFor(() => expect(within(columnaDelDia('Fri')).getByText('Carlos Ruiz')).toBeInTheDocument())

      await arrastrar('schedule-1', `day-${VIERNES}`, { altKey: true })

      await waitFor(() => expect(peticiones).toHaveLength(1))
      expect(peticiones[0].cuerpo).toEqual({ jobsId: 7, date: VIERNES, startTime: '07:00', employeesIds: [3, 5] })
    })

    it('si todos los de la tarjeta están ausentes el viernes, la copia se crea sin empleados', async () => {
      semilla.absences.push(
        { employeeAbsencesId: 2, employeesId: 3, date: VIERNES, absenceType: 'Vacation', absenceComment: null },
        { employeeAbsencesId: 3, employeesId: 5, date: VIERNES, absenceType: 'Sick', absenceComment: null },
      )
      await renderTablero()
      await waitFor(() => expect(within(columnaDelDia('Fri')).getByText('Luis Martínez')).toBeInTheDocument())

      await arrastrar('schedule-1', `day-${VIERNES}`, { altKey: true })

      await waitFor(() => expect(peticiones).toHaveLength(1))
      expect(peticiones[0].cuerpo).toEqual({ jobsId: 7, date: VIERNES, startTime: '07:00', employeesIds: [] })
      await waitFor(() => expect(tarjetasDelDia('Fri')).toHaveLength(1))
      expect(iniciales(tarjetasDelDia('Fri')[0])).toEqual([])
    })

    it('la ausencia de Luis el viernes no quita a Luis al duplicar a otro día: el sábado la copia lleva a Ana y Luis', async () => {
      semilla.absences.push({
        employeeAbsencesId: 2,
        employeesId: 5,
        date: VIERNES,
        absenceType: 'Sick',
        absenceComment: null,
      })
      await renderTablero()
      await waitFor(() => expect(within(columnaDelDia('Fri')).getByText('Luis Martínez')).toBeInTheDocument())

      await arrastrar('schedule-1', `day-${SABADO}`, { altKey: true })

      await waitFor(() => expect(peticiones).toHaveLength(1))
      expect(peticiones[0].cuerpo).toEqual({ jobsId: 7, date: SABADO, startTime: '07:00', employeesIds: [3, 5] })
    })

    it('en su mismo día: la copia queda a la hora siguiente a la más alta de ese trabajo, 09:00', async () => {
      await renderTablero()

      await arrastrar('schedule-1', `day-${LUNES}`, { altKey: true })

      await waitFor(() =>
        expect(peticiones).toEqual([
          {
            metodo: 'POST',
            ruta: '/v2/job-management/schedules',
            cuerpo: { jobsId: 7, date: LUNES, startTime: '09:00', employeesIds: [3, 5] },
          },
        ]),
      )
      await waitFor(() => expect(tarjetasDelDia('Mon')).toHaveLength(3))
    })
  })

  describe('quitar soltando en el catálogo', () => {
    it('DELETE de la programación: el jueves deja de mostrarla y el trabajo sigue en el catálogo', async () => {
      await renderTablero()
      const catalogo = within(
        screen.getByRole('heading', { level: 2, name: 'Jobs' }).closest('section') as HTMLElement,
      ).getByRole('list')
      await waitFor(() => expect(within(catalogo).getAllByRole('listitem')).toHaveLength(30))

      await arrastrar('schedule-4', 'catalog')

      await waitFor(() =>
        expect(peticiones).toEqual([{ metodo: 'DELETE', ruta: '/v2/job-management/schedules/4', cuerpo: null }]),
      )
      await waitFor(() => expect(tarjetasDelDia('Thu')).toHaveLength(0))
      expect(within(catalogo).getByText('J-1029').closest('li')).toHaveTextContent('Instalar lámparas')
      expect(within(catalogo).getAllByRole('listitem')).toHaveLength(30)
    })

    it('con Alt pulsado también la quita: Alt solo duplica al soltar en un día', async () => {
      await renderTablero()

      await arrastrar('schedule-1', 'catalog', { altKey: true })

      await waitFor(() =>
        expect(peticiones).toEqual([{ metodo: 'DELETE', ruta: '/v2/job-management/schedules/1', cuerpo: null }]),
      )
      await waitFor(() => expect(tarjetasDelDia('Mon')).toHaveLength(1))
    })
  })

  describe('empleados', () => {
    /** Tarjeta del día `nombre` que contiene `texto` (una hora o un número de trabajo). */
    const tarjeta = (nombre: string, texto: string) =>
      tarjetasDelDia(nombre).find((elemento) => elemento.textContent?.includes(texto)) as HTMLElement

    describe('asignar desde el panel', () => {
      it('Pedro en la tarjeta del jueves sin empleados: PUT con [4] y la tarjeta muestra "PS"', async () => {
        await renderTablero()

        await arrastrar('employee-4', 'card-4')

        await waitFor(() =>
          expect(peticiones).toEqual([
            { metodo: 'PUT', ruta: '/v2/job-management/schedules/4/employees', cuerpo: { employeesIds: [4] } },
          ]),
        )
        await waitFor(() => expect(iniciales(tarjeta('Thu', 'J-1029'))).toEqual(['PS']))
        expect(within(tarjeta('Thu', 'J-1029')).getByTitle('Pedro Sánchez')).toBeInTheDocument()
        expect(within(tarjeta('Thu', 'J-1029')).queryByText('No employees')).not.toBeInTheDocument()
      })

      it('Carlos en la tarjeta del lunes con Ana y Luis: PUT con [3, 5, 8], conservando a los que ya estaban', async () => {
        await renderTablero()

        await arrastrar('employee-8', 'card-1')

        await waitFor(() =>
          expect(peticiones).toEqual([
            { metodo: 'PUT', ruta: '/v2/job-management/schedules/1/employees', cuerpo: { employeesIds: [3, 5, 8] } },
          ]),
        )
        await waitFor(() => expect(iniciales(tarjeta('Mon', '07:00'))).toEqual(['AL', 'LM', 'CR']))
      })

      it('escenario "Soltar a Ana dos veces": Ana ya está en la tarjeta del lunes; no envía nada y sigue una sola vez', async () => {
        await renderTablero()

        await arrastrar('employee-3', 'card-1')

        await sinPeticiones()
        expect(iniciales(tarjeta('Mon', '07:00'))).toEqual(['AL', 'LM'])
      })

      it('Luis en una segunda programación del mismo lunes: queda asignado a ambas sin pedir confirmación', async () => {
        await renderTablero()

        await arrastrar('employee-5', 'card-2')

        await waitFor(() =>
          expect(peticiones).toEqual([
            { metodo: 'PUT', ruta: '/v2/job-management/schedules/2/employees', cuerpo: { employeesIds: [3, 5] } },
          ]),
        )
        await waitFor(() => expect(iniciales(tarjeta('Mon', '08:00'))).toEqual(['AL', 'LM']))
        expect(iniciales(tarjeta('Mon', '07:00'))).toEqual(['AL', 'LM'])
      })

      it('soltado fuera de cualquier tarjeta: no envía nada', async () => {
        await renderTablero()

        await arrastrar('employee-4', null)

        await sinPeticiones()
      })
    })

    describe('mover entre tarjetas', () => {
      it('Luis del lunes al martes: dos PUT, el lunes sin él y el martes con él', async () => {
        await renderTablero()

        await arrastrar('employee-5-in-1', 'card-3')

        await waitFor(() => expect(peticiones).toHaveLength(2))
        expect(peticiones).toEqual(
          expect.arrayContaining([
            { metodo: 'PUT', ruta: '/v2/job-management/schedules/1/employees', cuerpo: { employeesIds: [3] } },
            { metodo: 'PUT', ruta: '/v2/job-management/schedules/3/employees', cuerpo: { employeesIds: [8, 5] } },
          ]),
        )
        await waitFor(() => expect(iniciales(tarjeta('Tue', 'J-1019'))).toEqual(['CR', 'LM']))
        expect(iniciales(tarjeta('Mon', '07:00'))).toEqual(['AL'])
      })

      it('Ana a otra tarjeta donde ya está: un solo PUT que la retira del origen, sin repetirla en el destino', async () => {
        await renderTablero()

        await arrastrar('employee-3-in-1', 'card-2')

        await waitFor(() =>
          expect(peticiones).toEqual([
            { metodo: 'PUT', ruta: '/v2/job-management/schedules/1/employees', cuerpo: { employeesIds: [5] } },
          ]),
        )
        await waitFor(() => expect(iniciales(tarjeta('Mon', '07:00'))).toEqual(['LM']))
        expect(iniciales(tarjeta('Mon', '08:00'))).toEqual(['AL'])
      })

      it('soltada en su misma tarjeta: no envía nada', async () => {
        await renderTablero()

        await arrastrar('employee-3-in-1', 'card-1')

        await sinPeticiones()
        expect(iniciales(tarjeta('Mon', '07:00'))).toEqual(['AL', 'LM'])
      })
    })

    describe('retirar soltando fuera', () => {
      it('escenario "Arrastrar fuera": Ana de la tarjeta del lunes a las 07:00; PUT con [5] y la tarjeta deja de mostrarla', async () => {
        await renderTablero()

        await arrastrar('employee-3-in-1', null)

        await waitFor(() =>
          expect(peticiones).toEqual([
            { metodo: 'PUT', ruta: '/v2/job-management/schedules/1/employees', cuerpo: { employeesIds: [5] } },
          ]),
        )
        await waitFor(() => expect(iniciales(tarjeta('Mon', '07:00'))).toEqual(['LM']))
        // La otra programación de Ana ese día no cambia.
        expect(iniciales(tarjeta('Mon', '08:00'))).toEqual(['AL'])
      })

      it('al último empleado: PUT con la lista vacía y la tarjeta indica "No employees"', async () => {
        await renderTablero()

        await arrastrar('employee-8-in-3', null)

        await waitFor(() =>
          expect(peticiones).toEqual([
            { metodo: 'PUT', ruta: '/v2/job-management/schedules/3/employees', cuerpo: { employeesIds: [] } },
          ]),
        )
        await waitFor(() => expect(within(tarjeta('Tue', 'J-1019')).getByText('No employees')).toBeInTheDocument())
      })

      it('con el arrastre cancelado: no envía nada y Ana sigue en la tarjeta', async () => {
        await renderTablero()

        await arrastrar('employee-3-in-1', null, { cancelado: true })

        await sinPeticiones()
        expect(iniciales(tarjeta('Mon', '07:00'))).toEqual(['AL', 'LM'])
      })
    })
  })

  // Tarea 13.2: los recuadros de "Días con trabajo en la semana visible" del panel de empleados
  // (`specs/employee-assignment/spec.md`) se actualizan al asignar, mover, retirar y quitar.
  // Nivel 0 = vacío, 1 = tono claro, 2 = tono fuerte.
  describe('recuadros de días con trabajo del panel', () => {
    /** Recuadros (`role="img"`) de la fila del panel de empleados con el nombre `nombre`. */
    function recuadrosDe(nombre: string) {
      const panel = screen.getByRole('heading', { level: 2, name: 'Employees' }).closest('section') as HTMLElement
      const fila = within(panel).getByText(nombre).closest('li') as HTMLElement
      const contenedor = within(fila).getByRole('img')
      return {
        contenedor,
        niveles: Array.from(contenedor.children).map((recuadro) => recuadro.getAttribute('data-level')),
      }
    }

    it('escenario "Asignar actualiza los recuadros": Pedro sin trabajo el jueves; asignarlo a la tarjeta del jueves pinta su jueves', async () => {
      await renderTablero()
      expect(recuadrosDe('Pedro Sánchez').niveles).toEqual(['0', '0', '0', '0', '0', '0', '0'])
      expect(recuadrosDe('Pedro Sánchez').contenedor).toHaveAccessibleName('Assigned: none')

      await arrastrar('employee-4', 'card-4')

      await waitFor(() => expect(recuadrosDe('Pedro Sánchez').contenedor).toHaveAccessibleName('Assigned: Thu (1)'))
      expect(recuadrosDe('Pedro Sánchez').niveles).toEqual(['0', '0', '0', '0', '1', '0', '0'])
    })

    it('asignar a Luis a la segunda tarjeta del lunes pasa su lunes de tono claro a tono fuerte', async () => {
      await renderTablero()
      expect(recuadrosDe('Luis Martínez').niveles[1]).toBe('1')

      await arrastrar('employee-5', 'card-2')

      await waitFor(() => expect(recuadrosDe('Luis Martínez').niveles[1]).toBe('2'))
      expect(recuadrosDe('Luis Martínez').contenedor).toHaveAccessibleName('Assigned: Mon (2)')
    })

    it('mover a Luis de la tarjeta del lunes a la del martes mueve su recuadro del lunes al martes', async () => {
      await renderTablero()
      expect(recuadrosDe('Luis Martínez').contenedor).toHaveAccessibleName('Assigned: Mon (1)')

      await arrastrar('employee-5-in-1', 'card-3')

      await waitFor(() => expect(recuadrosDe('Luis Martínez').contenedor).toHaveAccessibleName('Assigned: Tue (1)'))
      expect(recuadrosDe('Luis Martínez').niveles).toEqual(['0', '0', '1', '0', '0', '0', '0'])
    })

    it('retirar a Ana de una tarjeta del lunes (soltándola fuera) baja su lunes de tono fuerte a tono claro', async () => {
      await renderTablero()
      expect(recuadrosDe('Ana López').niveles[1]).toBe('2')

      await arrastrar('employee-3-in-1', null)

      await waitFor(() => expect(recuadrosDe('Ana López').niveles[1]).toBe('1'))
      expect(recuadrosDe('Ana López').contenedor).toHaveAccessibleName('Assigned: Mon (1)')
    })

    it('mover la tarjeta del martes de Carlos al sábado mueve su recuadro al sábado', async () => {
      await renderTablero()

      await arrastrar('schedule-3', `day-${SABADO}`)

      await waitFor(() => expect(recuadrosDe('Carlos Ruiz').contenedor).toHaveAccessibleName('Assigned: Sat (1)'))
      expect(recuadrosDe('Carlos Ruiz').niveles).toEqual(['0', '0', '0', '0', '0', '0', '1'])
    })

    it('quitar la tarjeta del lunes con Ana y Luis (soltándola en el catálogo) actualiza los recuadros de ambos', async () => {
      await renderTablero()

      await arrastrar('schedule-1', 'catalog')

      await waitFor(() => expect(recuadrosDe('Luis Martínez').contenedor).toHaveAccessibleName('Assigned: none'))
      expect(recuadrosDe('Luis Martínez').niveles).toEqual(['0', '0', '0', '0', '0', '0', '0'])
      expect(recuadrosDe('Ana López').contenedor).toHaveAccessibleName('Assigned: Mon (1)')
    })
  })
})
