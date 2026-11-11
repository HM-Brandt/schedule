// Escenarios de "Deshacer" y de "Respuesta inmediata y error al guardar" en la página completa
// (tarea 8.3 de `schedule-assign`) con `msw/node`.
//
// Cubren de `specs/weekly-schedule-board/spec.md` los escenarios "Deshacer un movimiento",
// "Deshacer un quitar" (con su comentario), "Deshacer un cambio de comentario", "Deshacer un
// quitar con un empleado inactivo" y "Fallo al mover". Las acciones se hacen desde el detalle
// ("Move to", "Comment" y "Remove"), porque en jsdom el arrastre real no puede montarse sobre
// `App`; el arrastre se cubre en los e2e.
//
// La fecha del sistema se fija en el martes 2026-11-03. La semilla programa el lunes 2
// "J-1024 Pintar oficina" a las 07:00 con Ana López, Luis Martínez y el comentario "Llevar
// escalera", y a las 08:00 con Ana y sin comentario.
// Raúl Torres (9) está inactivo; los casos que lo necesitan lo añaden a la semilla.
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { createQueryClient } from '../api/queryClient'
import { createHandlers } from '../mocks/handlers'
import { createSeed } from '../mocks/seed'

const MIERCOLES = '2026-11-04'
const JUEVES = '2026-11-05'

const server = setupServer()

let semilla: ReturnType<typeof createSeed>
let client: QueryClient

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 3, 10, 0))
  semilla = createSeed(new Date(2026, 10, 3))
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

async function renderApp(total = 4) {
  server.resetHandlers(...createHandlers(semilla))
  render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  )
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(total))
  await waitFor(() => expect(screen.getAllByTitle('Ana López').length).toBeGreaterThan(0))
}

function columnaDelDia(nombre: string): HTMLElement {
  const encabezado = screen.getByText(nombre).parentElement as HTMLElement
  return encabezado.parentElement as HTMLElement
}

const tarjetasDelDia = (nombre: string) => within(columnaDelDia(nombre)).queryAllByRole('article')

const tarjeta = (nombre: string, texto: string) =>
  tarjetasDelDia(nombre).find((elemento) => elemento.textContent?.includes(texto))

const iniciales = (elemento: HTMLElement) =>
  Array.from(elemento.querySelectorAll('[title]:not([aria-label^="Comment:"])')).map((item) => item.textContent)

function abrirDetalle(elemento: HTMLElement | undefined, nombre: string): HTMLElement {
  fireEvent.click(elemento as HTMLElement)
  return screen.getByRole('dialog', { name: nombre })
}

describe('deshacer en la página', () => {
  it('escenario "Deshacer un movimiento": del lunes al jueves y "Undo" la devuelve al lunes con su hora y sus empleados', async () => {
    await renderApp()
    const detalle = abrirDetalle(tarjeta('Mon', '07:00'), 'J-1024 Pintar oficina')
    fireEvent.change(within(detalle).getByRole('combobox', { name: 'Move to' }), { target: { value: JUEVES } })
    fireEvent.click(within(detalle).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(tarjeta('Thu', 'J-1024')).toBeDefined())

    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))

    await waitFor(() => expect(tarjeta('Thu', 'J-1024')).toBeUndefined())
    const lunes = tarjetasDelDia('Mon')
    expect(lunes).toHaveLength(2)
    expect(lunes[0]).toHaveTextContent('07:00')
    expect(iniciales(lunes[0])).toEqual(['AL', 'LM'])
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  })

  it('escenario "Deshacer un quitar": quitar la de Ana y Luis con comentario y pulsar Ctrl+Z la devuelve con su hora, sus dos empleados y su comentario', async () => {
    await renderApp()
    const detalle = abrirDetalle(tarjeta('Mon', '07:00'), 'J-1024 Pintar oficina')
    fireEvent.click(within(detalle).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(tarjetasDelDia('Mon')).toHaveLength(1))
    await screen.findByText('Job removed')

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })

    await waitFor(() => expect(tarjetasDelDia('Mon')).toHaveLength(2))
    const devuelta = tarjeta('Mon', '07:00') as HTMLElement
    expect(devuelta).toHaveTextContent('J-1024')
    await waitFor(() => expect(iniciales(devuelta)).toEqual(['AL', 'LM']))
    expect(within(devuelta).getByLabelText('Comment: Llevar escalera')).toHaveAttribute('title', 'Llevar escalera')
    // La programación vuelve a crearse en el servidor: ya no es temporal y se puede abrir.
    await waitFor(() => expect(devuelta).toHaveAttribute('aria-disabled', 'false'))
    expect(abrirDetalle(devuelta, 'J-1024 Pintar oficina')).toBeInTheDocument()
  })

  it('escenario "Deshacer un cambio de comentario": de "Llevar escalera" a "Llevar andamio" y "Undo" vuelve a "Llevar escalera"', async () => {
    await renderApp()
    const detalle = abrirDetalle(tarjeta('Mon', '07:00'), 'J-1024 Pintar oficina')
    const campo = within(detalle).getByLabelText('Comment')
    fireEvent.change(campo, { target: { value: 'Llevar andamio' } })
    fireEvent.blur(campo)
    await waitFor(() =>
      expect(within(tarjeta('Mon', '07:00') as HTMLElement).getByLabelText('Comment: Llevar andamio')).toBeInTheDocument(),
    )
    await screen.findByText('Comment updated')

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))

    await waitFor(() =>
      expect(within(tarjeta('Mon', '07:00') as HTMLElement).getByLabelText('Comment: Llevar escalera')).toBeInTheDocument(),
    )
    expect(within(tarjeta('Mon', '07:00') as HTMLElement).queryByLabelText('Comment: Llevar andamio')).not.toBeInTheDocument()
    // El detalle, aún abierto, muestra también el comentario restaurado.
    expect(within(screen.getByRole('dialog')).getByLabelText('Comment')).toHaveValue('Llevar escalera')
  })

  it('escenario "Deshacer un quitar con un empleado inactivo": vuelve con Ana y sin Raúl', async () => {
    semilla.schedules.push({ jobSchedulesId: 10, job: semilla.jobs[13], date: MIERCOLES, startTime: '07:00', employeesIds: [3, 9], scheduleComment: null })
    await renderApp(5)
    const jardin = tarjeta('Wed', 'J-1031') as HTMLElement
    expect(within(jardin).getByTitle('Raúl Torres (inactive)')).toBeInTheDocument()
    const detalle = abrirDetalle(jardin, 'J-1031 Jardín Pérez')
    fireEvent.click(within(detalle).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(tarjetasDelDia('Wed')).toHaveLength(0))

    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))

    await waitFor(() => expect(tarjetasDelDia('Wed')).toHaveLength(1))
    const devuelta = tarjetasDelDia('Wed')[0]
    expect(devuelta).toHaveTextContent('J-1031')
    expect(devuelta).toHaveTextContent('07:00')
    await waitFor(() => expect(iniciales(devuelta)).toEqual(['AL']))
    expect(within(devuelta).queryByTitle(/Raúl Torres/)).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('error al guardar en la página', () => {
  it('escenario "Fallo al mover": al jueves con un 500, vuelve al lunes y el aviso empieza por "Couldn\'t save the change."', async () => {
    await renderApp()
    server.use(
      http.patch('/v1/schedules/:id', () =>
        HttpResponse.json({ error: 'Fallo simulado del servidor' }, { status: 500 }),
      ),
    )
    const detalle = abrirDetalle(tarjeta('Mon', '07:00'), 'J-1024 Pintar oficina')

    fireEvent.change(within(detalle).getByRole('combobox', { name: 'Move to' }), { target: { value: JUEVES } })

    const aviso = await screen.findByRole('alert')
    expect(aviso.textContent).toMatch(/^Couldn't save the change\./)
    expect(aviso).toHaveTextContent('Fallo simulado del servidor')
    await waitFor(() => expect(tarjeta('Thu', 'J-1024')).toBeUndefined())
    expect(tarjetasDelDia('Mon')).toHaveLength(2)
    expect(iniciales(tarjeta('Mon', '07:00') as HTMLElement)).toEqual(['AL', 'LM'])
    // No hay nada que deshacer.
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  })
})
