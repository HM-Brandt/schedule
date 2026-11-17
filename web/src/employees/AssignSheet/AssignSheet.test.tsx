// Tests del panel inferior de asignación del teléfono (tarea 9.4 de `schedule-assign`) con `msw/node`.
//
// Cubren el requisito "Asignación por lista en teléfono" de `specs/employee-assignment/spec.md`
// (escenarios "Marcar dos empleados" y "Desmarcar"): una casilla por empleado activo, marcarla o
// desmarcarla asigna o retira al empleado, y junto a cada uno se indica su carga de ese día.
//
// Se monta `AssignSheet` dentro de `UndoProvider` junto a la tarjeta de la misma programación y
// el aviso de deshacer, con los datos de la semana del 1 al 7 de noviembre que sirve la semilla.
// La semilla programa el lunes 2 "J-1024 Pintar oficina" (id 1) a las 07:00 con Ana López (3) y
// Luis Martínez (5), y otra (id 2) a las 08:00 con Ana. Tiene 8 empleados activos y 2 inactivos
// (Raúl Torres y Lucía Navarro).
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { http } from 'msw'
import { setupServer } from 'msw/node'
import { useState } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEmployees, useWeekSchedules } from '../../api/queries'
import { createQueryClient } from '../../api/queryClient'
import type { Schedule } from '../../api/types'
import { ScheduleCard } from '../../board/ScheduleCard'
import { createHandlers } from '../../mocks/handlers'
import { createSeed } from '../../mocks/seed'
import { UndoProvider } from '../../undo/UndoProvider'
import { UndoToast } from '../../undo/UndoToast'
import { AssignSheet } from './AssignSheet'

const ACTIVOS = [
  'Marta Gómez',
  'Jorge Pérez',
  'Ana López',
  'Pedro Sánchez',
  'Luis Martínez',
  'Elena Díaz',
  'Sofía Romero',
  'Carlos Ruiz',
]

const DIAS = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']

type Peticion = { ruta: string; cuerpo: unknown }

const server = setupServer()

let semilla: ReturnType<typeof createSeed>
let client: QueryClient
let reemplazos: Peticion[]

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 3, 10, 0))
  semilla = createSeed(new Date(2026, 10, 3))
  reemplazos = []
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

/** Registra los manejadores de la semilla y, delante, uno que anota cada `PUT …/employees`. */
function prepararServidor() {
  server.resetHandlers(
    http.put('/v2/job-management/schedules/:id/employees', async ({ request }) => {
      reemplazos.push({ ruta: new URL(request.url).pathname, cuerpo: await request.clone().json() })
      return undefined
    }),
    ...createHandlers(semilla),
  )
}

/** La tarjeta y el panel de asignación de la programación `id`, con los datos del servidor. */
function Arnes({ id, onClose }: { id: number; onClose: () => void }) {
  const schedules = useWeekSchedules('2026-11-01', '2026-11-07')
  const employees = useEmployees()
  const [abierto, setAbierto] = useState(true)
  const schedule = schedules.data?.find((item) => item.jobSchedulesId === id)
  if (!schedule || !employees.data) return null
  const porId = new Map(employees.data.map((empleado) => [empleado.employeesId, empleado]))

  return (
    <>
      <ScheduleCard schedule={schedule} employeesById={porId} />
      {abierto && (
        <AssignSheet
          schedule={schedule}
          employees={employees.data}
          schedules={schedules.data ?? []}
          days={DIAS}
          today="2026-11-03"
          onClose={() => {
            onClose()
            setAbierto(false)
          }}
        />
      )}
      <UndoToast />
    </>
  )
}

async function renderPanel(id = 1) {
  prepararServidor()
  const onClose = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <UndoProvider>
        <Arnes id={id} onClose={onClose} />
      </UndoProvider>
    </QueryClientProvider>,
  )
  const panel = await screen.findByRole('dialog', { name: 'Assign employees' })
  return { panel, onClose }
}

const casilla = (nombre: string) => screen.getByRole('checkbox', { name: nombre })

/** Iniciales de los empleados de la tarjeta, en orden. */
const iniciales = () => Array.from(screen.getByRole('article').querySelectorAll('[title]:not([aria-label^="Comment:"])')).map((item) => item.textContent)

/** Fila del panel con el nombre completo `nombre`. */
const fila = (panel: HTMLElement, nombre: string) =>
  within(panel)
    .getAllByRole('listitem')
    .find((item) => item.textContent?.includes(nombre)) as HTMLElement

describe('AssignSheet', () => {
  it('se titula "Assign employees" y tiene una casilla por cada uno de los 8 empleados activos', async () => {
    const { panel } = await renderPanel()

    expect(within(panel).getByRole('heading', { name: 'Assign employees' })).toBeInTheDocument()
    const casillas = within(panel).getAllByRole('checkbox')
    expect(casillas.map((elemento) => elemento.getAttribute('aria-label')).sort()).toEqual([...ACTIVOS].sort())
  })

  it('no ofrece a los inactivos Raúl Torres ni Lucía Navarro', async () => {
    const { panel } = await renderPanel()

    expect(within(panel).queryByRole('checkbox', { name: 'Raúl Torres' })).not.toBeInTheDocument()
    expect(within(panel).queryByRole('checkbox', { name: 'Lucía Navarro' })).not.toBeInTheDocument()
    expect(panel).not.toHaveTextContent('Raúl Torres')
    expect(panel).not.toHaveTextContent('Lucía Navarro')
  })

  it('solo ofrece a los Active: si Marta pasa a Terminated deja de tener casilla', async () => {
    semilla.employees = semilla.employees.map((empleado) =>
      empleado.firstName === 'Marta' ? { ...empleado, status: 'Terminated' } : empleado,
    )

    const { panel } = await renderPanel()

    expect(within(panel).getAllByRole('checkbox')).toHaveLength(7)
    expect(within(panel).queryByRole('checkbox', { name: 'Marta Gómez' })).not.toBeInTheDocument()
  })

  it('marca las casillas de los empleados ya asignados: Ana y Luis en la de las 07:00 del lunes', async () => {
    await renderPanel()

    expect(casilla('Ana López')).toBeChecked()
    expect(casilla('Luis Martínez')).toBeChecked()
    for (const nombre of ACTIVOS.filter((nombre) => nombre !== 'Ana López' && nombre !== 'Luis Martínez')) {
      expect(casilla(nombre)).not.toBeChecked()
    }
  })

  it('indica la carga del día: Ana "2 jobs", Luis "1 job" y nada para quien no trabaja el lunes', async () => {
    const { panel } = await renderPanel()

    expect(fila(panel, 'Ana López')).toHaveTextContent(/2 jobs$/)
    expect(fila(panel, 'Luis Martínez')).toHaveTextContent(/1 job$/)
    expect(fila(panel, 'Marta Gómez')).not.toHaveTextContent(/\d+ jobs?/)
    // Carlos Ruiz trabaja el martes, no el lunes.
    expect(fila(panel, 'Carlos Ruiz')).not.toHaveTextContent(/\d+ jobs?/)
  })

  describe('escenario "Marcar dos empleados"', () => {
    beforeEach(() => {
      // "J-1024 Pintar oficina" del lunes a las 07:00 empieza sin empleados.
      semilla.schedules[0].employeesIds = []
    })

    it('marcar a Ana y a Luis hace que la tarjeta los muestre y los guarda en el servidor', async () => {
      await renderPanel()
      expect(screen.getByRole('article')).toHaveTextContent('No employees')

      fireEvent.click(casilla('Ana López'))
      await waitFor(() => expect(casilla('Ana López')).toBeChecked())
      fireEvent.click(casilla('Luis Martínez'))
      await waitFor(() => expect(casilla('Luis Martínez')).toBeChecked())

      await waitFor(() => expect(iniciales()).toEqual(['AL', 'LM']))
      expect(screen.getByRole('article')).not.toHaveTextContent('No employees')
      await waitFor(() => expect(reemplazos).toHaveLength(2))
      expect(reemplazos).toEqual([
        { ruta: '/v2/job-management/schedules/1/employees', cuerpo: { employeesIds: [3] } },
        { ruta: '/v2/job-management/schedules/1/employees', cuerpo: { employeesIds: [3, 5] } },
      ])
    })

    it('al marcar a Ana su carga del lunes pasa de "1 job" a "2 jobs"', async () => {
      const { panel } = await renderPanel()
      expect(fila(panel, 'Ana López')).toHaveTextContent(/1 job$/)

      fireEvent.click(casilla('Ana López'))

      await waitFor(() => expect(fila(panel, 'Ana López')).toHaveTextContent(/2 jobs$/))
    })
  })

  describe('escenario "Desmarcar"', () => {
    it('desmarcar a Ana la retira de la tarjeta y lo guarda en el servidor, y Luis sigue asignado', async () => {
      await renderPanel()
      expect(iniciales()).toEqual(['AL', 'LM'])

      fireEvent.click(casilla('Ana López'))

      await waitFor(() => expect(casilla('Ana López')).not.toBeChecked())
      expect(casilla('Luis Martínez')).toBeChecked()
      await waitFor(() => expect(iniciales()).toEqual(['LM']))
      await waitFor(() => expect(reemplazos).toHaveLength(1))
      expect(reemplazos[0]).toEqual({ ruta: '/v2/job-management/schedules/1/employees', cuerpo: { employeesIds: [5] } })
    })

    it('desmarcar al único empleado deja la tarjeta con "No employees"', async () => {
      // La de las 08:00 del lunes solo tiene a Ana.
      await renderPanel(2)

      fireEvent.click(casilla('Ana López'))

      await waitFor(() => expect(screen.getByRole('article')).toHaveTextContent('No employees'))
    })
  })

  it('el cambio se puede deshacer: "Undo" tras desmarcar a Ana la vuelve a asignar', async () => {
    await renderPanel()
    fireEvent.click(casilla('Ana López'))
    await waitFor(() => expect(iniciales()).toEqual(['LM']))

    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))

    await waitFor(() => expect(casilla('Ana López')).toBeChecked())
    await waitFor(() => expect(iniciales()).toEqual(['AL', 'LM']))
  })

  it('"Done" cierra el panel sin cambiar nada', async () => {
    const { onClose } = await renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog', { name: 'Assign employees' })).not.toBeInTheDocument()
    expect(reemplazos).toHaveLength(0)
  })

  // Tareas 13.1 y 13.2: requisito "Días con trabajo en la semana visible" en la lista de casillas
  // del teléfono. Nivel 0 = vacío, 1 = tono claro, 2 = tono fuerte.
  describe('días con trabajo en la semana visible', () => {
    /** Recuadros (`role="img"`) de la fila del empleado `nombre`. */
    function recuadrosDe(panel: HTMLElement, nombre: string) {
      const contenedor = within(fila(panel, nombre)).getByRole('img')
      return {
        contenedor,
        niveles: Array.from(contenedor.children).map((recuadro) => recuadro.getAttribute('data-level')),
      }
    }

    it('cada empleado activo tiene sus siete recuadros dentro de la etiqueta de su casilla', async () => {
      const { panel } = await renderPanel()

      for (const nombre of ACTIVOS) {
        const { contenedor, niveles } = recuadrosDe(panel, nombre)
        expect(niveles).toHaveLength(7)
        expect(contenedor.closest('label')).toBe(casilla(nombre).closest('label'))
      }
      expect(within(panel).getAllByRole('img')).toHaveLength(8)
    })

    it('con la semilla: Ana con el lunes en tono fuerte, Luis en tono claro, Carlos el martes y Marta vacía', async () => {
      const { panel } = await renderPanel()

      expect(recuadrosDe(panel, 'Ana López').niveles).toEqual(['0', '2', '0', '0', '0', '0', '0'])
      expect(recuadrosDe(panel, 'Ana López').contenedor).toHaveAccessibleName('Assigned: Mon (2)')
      expect(recuadrosDe(panel, 'Luis Martínez').contenedor).toHaveAccessibleName('Assigned: Mon (1)')
      expect(recuadrosDe(panel, 'Carlos Ruiz').niveles).toEqual(['0', '0', '1', '0', '0', '0', '0'])
      expect(recuadrosDe(panel, 'Marta Gómez').contenedor).toHaveAccessibleName('Assigned: none')
    })

    it('marca el día actual (martes 3) en los recuadros', async () => {
      const { panel } = await renderPanel()

      const hoy = Array.from(recuadrosDe(panel, 'Marta Gómez').contenedor.children).map((recuadro) =>
        recuadro.hasAttribute('data-today'),
      )
      expect(hoy).toEqual([false, false, true, false, false, false, false])
    })

    it('la etiqueta "N jobs" del día se mantiene junto a los recuadros', async () => {
      const { panel } = await renderPanel()

      expect(fila(panel, 'Ana López')).toHaveTextContent(/2 jobs$/)
      expect(recuadrosDe(panel, 'Ana López').niveles[1]).toBe('2')
    })

    it('escenario "Asignar actualiza los recuadros": marcar a Pedro en la tarjeta del jueves pinta su jueves', async () => {
      const { panel } = await renderPanel(4)
      expect(recuadrosDe(panel, 'Pedro Sánchez').contenedor).toHaveAccessibleName('Assigned: none')

      fireEvent.click(casilla('Pedro Sánchez'))

      await waitFor(() =>
        expect(recuadrosDe(panel, 'Pedro Sánchez').contenedor).toHaveAccessibleName('Assigned: Thu (1)'),
      )
      expect(recuadrosDe(panel, 'Pedro Sánchez').niveles).toEqual(['0', '0', '0', '0', '1', '0', '0'])
    })

    it('desmarcar a Ana en la tarjeta del lunes baja su lunes de tono fuerte a tono claro', async () => {
      const { panel } = await renderPanel()

      fireEvent.click(casilla('Ana López'))

      await waitFor(() => expect(recuadrosDe(panel, 'Ana López').niveles[1]).toBe('1'))
      expect(recuadrosDe(panel, 'Ana López').contenedor).toHaveAccessibleName('Assigned: Mon (1)')
    })
  })

  it('si la programación ya no está en la semana, el panel se cierra solo', async () => {
    prepararServidor()
    const onClose = vi.fn()
    const desaparecida: Schedule = { ...semilla.schedules[0], jobSchedulesId: 99 }
    render(
      <QueryClientProvider client={client}>
        <UndoProvider>
          <AssignSheet
            schedule={desaparecida}
            employees={semilla.employees}
            schedules={semilla.schedules}
            days={DIAS}
            today="2026-11-03"
            onClose={onClose}
          />
        </UndoProvider>
      </QueryClientProvider>,
    )

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
