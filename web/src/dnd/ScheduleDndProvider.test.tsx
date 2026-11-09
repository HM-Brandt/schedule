// Tests del despacho al soltar de `ScheduleDndProvider` (tareas 6.3 y 6.4 de `schedule-assign`)
// con `msw/node`.
//
// Cubren de `specs/weekly-schedule-board/spec.md` los requisitos "Mover una programación a
// otro día", "Duplicar una programación" (escenario "Duplicar con Alt en otro día") y "Quitar
// una programación" (escenario "Arrastrar de vuelta al catálogo"), y la decisión 5 de
// `design.md`. Para cada acción se comprueba la petición que llega al servidor (método, ruta
// y cuerpo) y cómo queda el tablero.
//
// Se monta el proveedor real con el catálogo y las siete columnas de la semana, y el
// arrastre se maneja con las acciones del gestor de @dnd-kit (ver `src/test/dnd.tsx`).
//
// La fecha del sistema se fija en el martes 2026-11-03. La semilla programa esa semana:
// - lunes 2: "J-1024 Pintar oficina" (id 1) a las 07:00 con Ana López (3) y Luis Martínez (5),
//   y otra (id 2) a las 08:00 con Ana;
// - martes 3: "J-1019 Cambiar ventanas" (id 3) a las 07:00 con Carlos Ruiz (8);
// - jueves 5: "J-1029 Instalar lámparas" (id 4) a las 09:30, sin empleados.
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import { http } from 'msw'
import { setupServer } from 'msw/node'
import { useMemo } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEmployees, useWeekSchedules } from '../api/queries'
import { createQueryClient } from '../api/queryClient'
import { WeekBoard } from '../board/WeekBoard'
import { JobCatalog } from '../catalog/JobCatalog'
import { schedulesByDay } from '../lib/selectors'
import { createHandlers } from '../mocks/handlers'
import { createSeed } from '../mocks/seed'
import { CapturadorDelGestor, arrastrar, simularApisDeArrastre } from '../test/dnd'
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
    http.post('/api/schedules', anotar),
    http.patch('/api/schedules/:id', anotar),
    http.delete('/api/schedules/:id', anotar),
    http.put('/api/schedules/:id/employees', anotar),
    ...createHandlers(semilla),
  )
}

/** El catálogo y el tablero de la semana del 1 al 7 de noviembre dentro del proveedor de arrastre. */
function Tablero() {
  const schedules = useWeekSchedules(DIAS[0], DIAS[6])
  const employees = useEmployees()
  const employeesById = useMemo(
    () => new Map((employees.data ?? []).map((employee) => [employee.id, employee])),
    [employees.data],
  )
  const byDay = useMemo(() => schedulesByDay(schedules.data ?? [], DIAS), [schedules.data])

  return (
    <ScheduleDndProvider schedules={schedules.data ?? []}>
      <CapturadorDelGestor />
      <JobCatalog counts={new Map()} />
      <WeekBoard days={DIAS} today={MARTES} schedulesByDay={byDay} employeesById={employeesById} />
    </ScheduleDndProvider>
  )
}

/** Monta el tablero y espera a que estén cargadas las `total` programaciones de la semilla y los empleados. */
async function renderTablero(total = 4) {
  prepararServidor()
  render(
    <QueryClientProvider client={client}>
      <Tablero />
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
  Array.from(tarjeta.querySelectorAll('[title]')).map((elemento) => elemento.textContent)

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
          { metodo: 'PATCH', ruta: '/api/schedules/1', cuerpo: { date: MARTES, start_time: '07:00' } },
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
          { metodo: 'PATCH', ruta: '/api/schedules/4', cuerpo: { date: SABADO, start_time: '09:30' } },
        ]),
      )
      await waitFor(() => expect(tarjetasDelDia('Sat')).toHaveLength(1))
      expect(tarjetasDelDia('Sat')[0]).toHaveTextContent('09:30')
      expect(tarjetasDelDia('Thu')).toHaveLength(0)
    })

    it('a un día que ya tiene ese trabajo a las 07:00: PATCH con la hora recalculada 08:00', async () => {
      semilla.schedules.push({ id: 10, job: semilla.jobs[6], date: MARTES, start_time: '07:00', employee_ids: [] })
      await renderTablero(5)
      expect(tarjetasDelDia('Tue')).toHaveLength(2)

      await arrastrar('schedule-1', `day-${MARTES}`)

      await waitFor(() =>
        expect(peticiones).toEqual([
          { metodo: 'PATCH', ruta: '/api/schedules/1', cuerpo: { date: MARTES, start_time: '08:00' } },
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
            ruta: '/api/schedules',
            cuerpo: { job_id: 7, date: VIERNES, start_time: '07:00', employee_ids: [3, 5] },
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
      expect(peticiones[0].cuerpo).toEqual({ job_id: 7, date: VIERNES, start_time: '07:00', employee_ids: [3] })
    })

    it('una tarjeta sin empleados: la copia se envía con la lista vacía', async () => {
      await renderTablero()

      await arrastrar('schedule-4', `day-${VIERNES}`, { altKey: true })

      await waitFor(() => expect(peticiones).toHaveLength(1))
      expect(peticiones[0]).toEqual({
        metodo: 'POST',
        ruta: '/api/schedules',
        cuerpo: { job_id: 12, date: VIERNES, start_time: '07:00', employee_ids: [] },
      })
    })

    it('en su mismo día: la copia queda a la hora siguiente a la más alta de ese trabajo, 09:00', async () => {
      await renderTablero()

      await arrastrar('schedule-1', `day-${LUNES}`, { altKey: true })

      await waitFor(() =>
        expect(peticiones).toEqual([
          {
            metodo: 'POST',
            ruta: '/api/schedules',
            cuerpo: { job_id: 7, date: LUNES, start_time: '09:00', employee_ids: [3, 5] },
          },
        ]),
      )
      await waitFor(() => expect(tarjetasDelDia('Mon')).toHaveLength(3))
    })
  })

  describe('quitar soltando en el catálogo', () => {
    it('DELETE de la programación: el jueves deja de mostrarla y el trabajo sigue en el catálogo', async () => {
      await renderTablero()
      const catalogo = screen.getByRole('list')
      await waitFor(() => expect(within(catalogo).getAllByRole('listitem')).toHaveLength(30))

      await arrastrar('schedule-4', 'catalog')

      await waitFor(() =>
        expect(peticiones).toEqual([{ metodo: 'DELETE', ruta: '/api/schedules/4', cuerpo: null }]),
      )
      await waitFor(() => expect(tarjetasDelDia('Thu')).toHaveLength(0))
      expect(within(catalogo).getByText('J-1029').closest('li')).toHaveTextContent('Instalar lámparas')
      expect(within(catalogo).getAllByRole('listitem')).toHaveLength(30)
    })

    it('con Alt pulsado también la quita: Alt solo duplica al soltar en un día', async () => {
      await renderTablero()

      await arrastrar('schedule-1', 'catalog', { altKey: true })

      await waitFor(() =>
        expect(peticiones).toEqual([{ metodo: 'DELETE', ruta: '/api/schedules/1', cuerpo: null }]),
      )
      await waitFor(() => expect(tarjetasDelDia('Mon')).toHaveLength(1))
    })
  })
})
