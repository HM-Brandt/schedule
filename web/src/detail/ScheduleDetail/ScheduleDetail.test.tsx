// Tests del panel de detalle de una programación (tarea 8.1 de `schedule-assign`) con `msw/node`.
//
// Cubren de `specs/weekly-schedule-board/spec.md` los requisitos "Solo hora de inicio"
// (escenario "Editar la hora de inicio": a 10:30, la tarjeta lo muestra y se reordena en su
// día), "Duplicar una programación" (escenario "Duplicar desde el detalle en el mismo día"),
// "Mover una programación a otro día" (con "Move to") y "Quitar una programación"; y de
// `specs/employee-assignment/spec.md`, "Retirar un empleado de una programación" (desde el
// detalle) y "Empleados que pasan a inactivos" (el detalle lo marca como inactivo).
//
// Se monta la aplicación completa: el detalle se abre al pulsar una tarjeta y sus cambios se
// comprueban en el tablero y en las peticiones que llegan al servidor.
//
// La fecha del sistema se fija en el martes 2026-11-03. La semilla programa esa semana:
// - lunes 2: "J-1024 Pintar oficina" (id 1) a las 07:00 con Ana López y Luis Martínez, y otra
//   (id 2) a las 08:00 con Ana;
// - martes 3: "J-1019 Cambiar ventanas" (id 3) a las 07:00 con Carlos Ruiz;
// - jueves 5: "J-1029 Instalar lámparas" (id 4) a las 09:30, sin empleados.
// Raúl Torres (9) está inactivo.
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { createQueryClient } from '../../api/queryClient'
import { createHandlers } from '../../mocks/handlers'
import { createSeed } from '../../mocks/seed'

const LUNES = '2026-11-02'
const MIERCOLES = '2026-11-04'
const JUEVES = '2026-11-05'

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

/** Registra los manejadores de la semilla y, delante, uno que anota cada petición de cambio. */
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

/** Monta la aplicación y espera a que estén las `total` programaciones y los empleados. */
async function renderApp(total = 4) {
  prepararServidor()
  render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  )
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(total))
  await waitFor(() => expect(screen.getAllByTitle('Ana López').length).toBeGreaterThan(0))
}

/** Columna del día con nombre abreviado `nombre` ("Mon"): su encabezado y sus tarjetas. */
function columnaDelDia(nombre: string): HTMLElement {
  const encabezado = screen.getByText(nombre).parentElement as HTMLElement
  return encabezado.parentElement as HTMLElement
}

const tarjetasDelDia = (nombre: string) => within(columnaDelDia(nombre)).queryAllByRole('article')

/** Tarjeta del día `nombre` que contiene `texto` (una hora o un número de trabajo). */
const tarjeta = (nombre: string, texto: string) =>
  tarjetasDelDia(nombre).find((elemento) => elemento.textContent?.includes(texto)) as HTMLElement

/** Hora que muestra cada tarjeta del día, en orden. */
const horasDelDia = (nombre: string) =>
  tarjetasDelDia(nombre).map((elemento) => elemento.textContent?.match(/\d{2}:\d{2}/)?.[0])

/** Iniciales de los empleados de una tarjeta, en orden. */
const iniciales = (elemento: HTMLElement) =>
  Array.from(elemento.querySelectorAll('[title]')).map((item) => item.textContent)

/** Pulsa la tarjeta y devuelve el panel de detalle que abre. */
function abrirDetalle(elemento: HTMLElement, nombre: string): HTMLElement {
  fireEvent.click(elemento)
  return screen.getByRole('dialog', { name: nombre })
}

const campoHora = (detalle: HTMLElement) => within(detalle).getByLabelText('Start time') as HTMLInputElement

describe('ScheduleDetail', () => {
  it('al pulsar una tarjeta muestra su número y nombre, la fecha, la hora, los empleados y las acciones', async () => {
    await renderApp()

    const detalle = abrirDetalle(tarjeta('Mon', '07:00'), 'J-1024 Pintar oficina')

    expect(detalle).toHaveTextContent('J-1024')
    expect(within(detalle).getByRole('heading', { name: 'Pintar oficina' })).toBeInTheDocument()
    expect(within(detalle).getByText('Mon, Nov 2', { selector: 'div' })).toBeInTheDocument()
    expect(campoHora(detalle)).toHaveValue('07:00')
    expect(within(detalle).getByText('Ana López')).toBeInTheDocument()
    expect(within(detalle).getByText('Luis Martínez')).toBeInTheDocument()
    expect(within(detalle).getByRole('button', { name: 'Remove Ana López' })).toBeInTheDocument()
    expect(within(detalle).getByRole('button', { name: 'Remove Luis Martínez' })).toBeInTheDocument()
    expect(within(detalle).getByRole('combobox', { name: 'Move to' })).toHaveValue(LUNES)
    expect(within(detalle).getAllByRole('option')).toHaveLength(7)
    for (const accion of ['Duplicate', 'Remove', 'Close']) {
      expect(within(detalle).getByRole('button', { name: accion })).toBeInTheDocument()
    }
    // Solo hora de inicio: ni hora de fin ni duración.
    expect(within(detalle).queryByText(/end|duration/i)).not.toBeInTheDocument()
  })

  it('"Close" cierra el detalle sin enviar nada', async () => {
    await renderApp()
    const detalle = abrirDetalle(tarjeta('Mon', '07:00'), 'J-1024 Pintar oficina')

    fireEvent.click(within(detalle).getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(peticiones).toEqual([])
  })

  describe('hora de inicio', () => {
    it('escenario "Editar la hora de inicio": a 10:30 la tarjeta muestra "10:30" y pasa detrás de la de las 08:00', async () => {
      await renderApp()
      expect(horasDelDia('Mon')).toEqual(['07:00', '08:00'])
      const detalle = abrirDetalle(tarjeta('Mon', '07:00'), 'J-1024 Pintar oficina')

      fireEvent.change(campoHora(detalle), { target: { value: '10:30' } })
      fireEvent.blur(campoHora(detalle))

      await waitFor(() => expect(horasDelDia('Mon')).toEqual(['08:00', '10:30']))
      // La de las 10:30 es la editada: conserva a Ana y Luis.
      expect(iniciales(tarjetasDelDia('Mon')[1])).toEqual(['AL', 'LM'])
      expect(iniciales(tarjetasDelDia('Mon')[0])).toEqual(['AL'])
      await waitFor(() =>
        expect(peticiones).toEqual([{ metodo: 'PATCH', ruta: '/api/schedules/1', cuerpo: { start_time: '10:30' } }]),
      )
      expect(campoHora(screen.getByRole('dialog'))).toHaveValue('10:30')
      expect(await screen.findByText('Start time changed')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
    })

    it('con Enter también guarda la hora', async () => {
      await renderApp()
      const detalle = abrirDetalle(tarjeta('Mon', '07:00'), 'J-1024 Pintar oficina')
      const campo = campoHora(detalle)

      act(() => campo.focus())
      fireEvent.change(campo, { target: { value: '10:30' } })
      fireEvent.keyDown(campo, { key: 'Enter' })

      await waitFor(() =>
        expect(peticiones).toEqual([{ metodo: 'PATCH', ruta: '/api/schedules/1', cuerpo: { start_time: '10:30' } }]),
      )
      await waitFor(() => expect(horasDelDia('Mon')).toEqual(['08:00', '10:30']))
    })

    it('al salir del campo sin cambiar la hora no envía nada', async () => {
      await renderApp()
      const detalle = abrirDetalle(tarjeta('Mon', '07:00'), 'J-1024 Pintar oficina')

      fireEvent.blur(campoHora(detalle))

      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(peticiones).toEqual([])
    })

    it('al vaciar el campo no envía nada', async () => {
      await renderApp()
      const detalle = abrirDetalle(tarjeta('Mon', '07:00'), 'J-1024 Pintar oficina')

      fireEvent.change(campoHora(detalle), { target: { value: '' } })
      fireEvent.blur(campoHora(detalle))

      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(peticiones).toEqual([])
      expect(horasDelDia('Mon')).toEqual(['07:00', '08:00'])
    })
  })

  describe('"Duplicate"', () => {
    it('escenario "Duplicar desde el detalle en el mismo día": "J-1024" (07:00) del lunes tiene una segunda a las 08:00', async () => {
      // El lunes solo tiene "J-1024 Pintar oficina" a las 07:00, con Ana y Luis.
      semilla.schedules = semilla.schedules.filter((programacion) => programacion.id !== 2)
      await renderApp(3)
      const detalle = abrirDetalle(tarjeta('Mon', '07:00'), 'J-1024 Pintar oficina')

      fireEvent.click(within(detalle).getByRole('button', { name: 'Duplicate' }))

      await waitFor(() => expect(tarjetasDelDia('Mon')).toHaveLength(2))
      expect(horasDelDia('Mon')).toEqual(['07:00', '08:00'])
      for (const elemento of tarjetasDelDia('Mon')) {
        expect(elemento).toHaveTextContent('J-1024')
        expect(elemento).toHaveTextContent('Pintar oficina')
      }
      expect(iniciales(tarjeta('Mon', '08:00'))).toEqual(['AL', 'LM'])
      await waitFor(() =>
        expect(peticiones).toEqual([
          {
            metodo: 'POST',
            ruta: '/api/schedules',
            cuerpo: { job_id: 7, date: LUNES, start_time: '08:00', employee_ids: [3, 5] },
          },
        ]),
      )
      // El detalle sigue abierto en la original.
      expect(campoHora(screen.getByRole('dialog', { name: 'J-1024 Pintar oficina' }))).toHaveValue('07:00')
      expect(await screen.findByText('Job duplicated')).toBeInTheDocument()
    })

    it('la copia no lleva a los empleados inactivos', async () => {
      semilla.schedules.push({ id: 10, job: semilla.jobs[13], date: MIERCOLES, start_time: '07:00', employee_ids: [3, 9] })
      await renderApp(5)
      const detalle = abrirDetalle(tarjeta('Wed', 'J-1031'), 'J-1031 Jardín Pérez')

      fireEvent.click(within(detalle).getByRole('button', { name: 'Duplicate' }))

      await waitFor(() => expect(tarjetasDelDia('Wed')).toHaveLength(2))
      expect(iniciales(tarjeta('Wed', '08:00'))).toEqual(['AL'])
      await waitFor(() =>
        expect(peticiones).toEqual([
          {
            metodo: 'POST',
            ruta: '/api/schedules',
            cuerpo: { job_id: 14, date: MIERCOLES, start_time: '08:00', employee_ids: [3] },
          },
        ]),
      )
    })
  })

  it('"Move to" el jueves mueve la programación con su hora y sus empleados', async () => {
    await renderApp()
    const detalle = abrirDetalle(tarjeta('Mon', '07:00'), 'J-1024 Pintar oficina')

    fireEvent.change(within(detalle).getByRole('combobox', { name: 'Move to' }), { target: { value: JUEVES } })

    await waitFor(() => expect(tarjetasDelDia('Thu')).toHaveLength(2))
    const movida = tarjeta('Thu', 'J-1024')
    expect(movida).toHaveTextContent('07:00')
    expect(iniciales(movida)).toEqual(['AL', 'LM'])
    expect(horasDelDia('Mon')).toEqual(['08:00'])
    await waitFor(() =>
      expect(peticiones).toEqual([
        { metodo: 'PATCH', ruta: '/api/schedules/1', cuerpo: { date: JUEVES, start_time: '07:00' } },
      ]),
    )
    // El detalle sigue abierto y muestra la nueva fecha.
    const abierto = screen.getByRole('dialog', { name: 'J-1024 Pintar oficina' })
    expect(within(abierto).getByText('Thu, Nov 5', { selector: 'div' })).toBeInTheDocument()
    expect(within(abierto).getByRole('combobox', { name: 'Move to' })).toHaveValue(JUEVES)
    expect(await screen.findByText('Job moved')).toBeInTheDocument()
  })

  it('"Remove" quita la programación del día y cierra el detalle', async () => {
    await renderApp()
    const detalle = abrirDetalle(tarjeta('Thu', 'J-1029'), 'J-1029 Instalar lámparas')

    fireEvent.click(within(detalle).getByRole('button', { name: 'Remove' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(tarjetasDelDia('Thu')).toHaveLength(0))
    await waitFor(() =>
      expect(peticiones).toEqual([{ metodo: 'DELETE', ruta: '/api/schedules/4', cuerpo: null }]),
    )
    expect(await screen.findByText('Job removed')).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(3)
  })

  describe('empleados', () => {
    it('"Remove Ana López" la retira de la programación', async () => {
      await renderApp()
      const detalle = abrirDetalle(tarjeta('Mon', '07:00'), 'J-1024 Pintar oficina')

      fireEvent.click(within(detalle).getByRole('button', { name: 'Remove Ana López' }))

      await waitFor(() => expect(iniciales(tarjeta('Mon', '07:00'))).toEqual(['LM']))
      const abierto = screen.getByRole('dialog', { name: 'J-1024 Pintar oficina' })
      expect(within(abierto).queryByText('Ana López')).not.toBeInTheDocument()
      expect(within(abierto).getByText('Luis Martínez')).toBeInTheDocument()
      await waitFor(() =>
        expect(peticiones).toEqual([
          { metodo: 'PUT', ruta: '/api/schedules/1/employees', cuerpo: { employee_ids: [5] } },
        ]),
      )
      // La otra programación de Ana ese día no cambia.
      expect(iniciales(tarjeta('Mon', '08:00'))).toEqual(['AL'])
      expect(await screen.findByText('Employees updated')).toBeInTheDocument()
    })

    it('retirar al último empleado deja la tarjeta con "No employees"', async () => {
      await renderApp()
      const detalle = abrirDetalle(tarjeta('Tue', 'J-1019'), 'J-1019 Cambiar ventanas')

      fireEvent.click(within(detalle).getByRole('button', { name: 'Remove Carlos Ruiz' }))

      await waitFor(() => expect(within(tarjeta('Tue', 'J-1019')).getByText('No employees')).toBeInTheDocument())
      expect(within(screen.getByRole('dialog')).queryAllByRole('listitem')).toHaveLength(0)
    })

    it('un empleado inactivo aparece con "(inactive)" y se puede retirar', async () => {
      semilla.schedules.push({ id: 10, job: semilla.jobs[13], date: MIERCOLES, start_time: '07:00', employee_ids: [3, 9] })
      await renderApp(5)
      const detalle = abrirDetalle(tarjeta('Wed', 'J-1031'), 'J-1031 Jardín Pérez')

      expect(within(detalle).getByText('Raúl Torres (inactive)')).toBeInTheDocument()
      expect(within(detalle).getByText('Ana López')).toBeInTheDocument()
      expect(within(detalle).queryByText('Ana López (inactive)')).not.toBeInTheDocument()

      fireEvent.click(within(detalle).getByRole('button', { name: 'Remove Raúl Torres' }))

      await waitFor(() =>
        expect(peticiones).toEqual([
          { metodo: 'PUT', ruta: '/api/schedules/10/employees', cuerpo: { employee_ids: [3] } },
        ]),
      )
      await waitFor(() =>
        expect(within(screen.getByRole('dialog')).queryByText('Raúl Torres (inactive)')).not.toBeInTheDocument(),
      )
      expect(iniciales(tarjeta('Wed', 'J-1031'))).toEqual(['AL'])
    })
  })
})
