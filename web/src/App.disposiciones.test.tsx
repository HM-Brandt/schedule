// Tests de las disposiciones de tablet y teléfono de la página inicial (tareas 9.2, 9.3 y 9.4 de
// `schedule-assign`) con `msw/node`.
//
// Cubren de `specs/weekly-schedule-board/spec.md` los requisitos "Diseño responsivo por tamaño de
// pantalla" (escenarios "Tablet vertical" y "Teléfono") y "Tira de días en teléfono" (escenario
// "Cambiar de día"); de `specs/employee-assignment/spec.md`, que el "+" de la tarjeta abre la
// asignación por lista; y la decisión 8 de `design.md`: cajones laterales en tablet y paneles
// inferiores en teléfono. jsdom no aplica el CSS, así que el desplazamiento horizontal de la
// tablet y lo que cabe en pantalla se comprueban en los e2e (`e2e/disposicion-responsiva.spec.ts`).
//
// El ancho se simula con `simularAncho` (ver `src/test/viewport.ts`): 800 px para la tablet y
// 390 px para el teléfono. La disposición de escritorio (1280 px) la cubre `App.test.tsx`.
//
// La fecha del sistema se fija en el martes 2026-11-03 a las 10:00. La semilla programa esa semana:
// - lunes 2: "J-1024 Pintar oficina" a las 07:00 (Ana López y Luis Martínez) y a las 08:00 (Ana);
// - martes 3: "J-1019 Cambiar ventanas" a las 07:00 (Carlos Ruiz);
// - jueves 5: "J-1029 Instalar lámparas" a las 09:30, sin empleados.
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createQueryClient } from './api/queryClient'
import { createHandlers } from './mocks/handlers'
import { createSeed } from './mocks/seed'
import { simularAncho } from './test/viewport'

const NOMBRES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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
  server.resetHandlers(...createHandlers(semilla))
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

/** Renderiza la página con el ancho `ancho` y espera a que carguen las programaciones y los empleados. */
async function renderAppCon(ancho: number, tarjetasVisibles: number) {
  simularAncho(ancho)
  render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  )
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(tarjetasVisibles))
}

/** Encabezados de las columnas de día del tablero (los de la tira de días son botones). */
const encabezadosDeDia = () =>
  screen
    .queryAllByText(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/)
    .filter((nombre) => !nombre.closest('button'))
    .map((nombre) => (nombre.parentElement as HTMLElement).textContent?.replace(/^([A-Za-z]{3})(\d+)$/, '$1 $2'))

/**
 * Botones de los días de la tira: `<button>` con `aria-pressed`. Los chips de empleados también
 * tienen rol de botón y `aria-pressed` (los pone @dnd-kit), pero son `<span>`.
 */
const diasDeLaTira = () =>
  screen.queryAllByRole('button').filter((boton) => boton.tagName === 'BUTTON' && boton.hasAttribute('aria-pressed'))

/** Botón de la tira del día con nombre abreviado `nombre` ("Thu"). */
const diaDeLaTira = (nombre: string) =>
  diasDeLaTira().find((boton) => within(boton).queryByText(nombre, { exact: true })) as HTMLElement

const tarjetas = () => screen.queryAllByRole('article')

describe('App en tablet (800 px)', () => {
  it('escenario "Tablet vertical": el tablero tiene las siete columnas y no hay tira de días', async () => {
    await renderAppCon(800, 4)

    expect(encabezadosDeDia()).toEqual(['Sun 1', 'Mon 2', 'Tue 3', 'Wed 4', 'Thu 5', 'Fri 6', 'Sat 7'])
    expect(diasDeLaTira()).toHaveLength(0)
  })

  it('el catálogo y los empleados no se muestran hasta abrir su cajón', async () => {
    await renderAppCon(800, 4)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'Jobs' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'Employees' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Jobs' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Employees' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('"Jobs" abre el cajón izquierdo con el catálogo', async () => {
    await renderAppCon(800, 4)

    fireEvent.click(screen.getByRole('button', { name: 'Jobs' }))

    const cajon = screen.getByRole('dialog', { name: 'Jobs' })
    expect(cajon).toHaveClass(/left/)
    expect(within(cajon).getByRole('searchbox', { name: 'Search jobs' })).toBeInTheDocument()
    await waitFor(() => expect(within(cajon).getAllByRole('listitem')).toHaveLength(30))
    expect(screen.getByRole('button', { name: 'Jobs' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('"Employees" abre el cajón derecho con los empleados activos', async () => {
    await renderAppCon(800, 4)

    fireEvent.click(screen.getByRole('button', { name: 'Employees' }))

    const cajon = screen.getByRole('dialog', { name: 'Employees' })
    expect(cajon).toHaveClass(/right/)
    await waitFor(() => expect(within(cajon).getAllByRole('listitem')).toHaveLength(8))
    expect(within(cajon).getByText('Ana López')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Employees' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('solo hay un cajón abierto a la vez: abrir "Employees" cierra "Jobs" y al revés', async () => {
    await renderAppCon(800, 4)

    fireEvent.click(screen.getByRole('button', { name: 'Jobs' }))
    fireEvent.click(screen.getByRole('button', { name: 'Employees' }))

    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog', { name: 'Employees' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Jobs' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Employees' })).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Jobs' }))

    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog', { name: 'Jobs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Employees' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('"Close" cierra el cajón abierto', async () => {
    await renderAppCon(800, 4)
    fireEvent.click(screen.getByRole('button', { name: 'Jobs' }))

    fireEvent.click(within(screen.getByRole('dialog', { name: 'Jobs' })).getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Jobs' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('volver a pulsar "Jobs" con su cajón abierto lo cierra', async () => {
    await renderAppCon(800, 4)
    fireEvent.click(screen.getByRole('button', { name: 'Jobs' }))

    fireEvent.click(screen.getByRole('button', { name: 'Jobs' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('las tarjetas no muestran el "+" de asignación por lista', async () => {
    await renderAppCon(800, 4)

    expect(screen.queryByRole('button', { name: 'Assign employees' })).not.toBeInTheDocument()
  })
})

describe('App en teléfono (390 px)', () => {
  it('escenario "Teléfono": se ve un solo día, el de hoy (martes 3), y la tira con los siete días', async () => {
    await renderAppCon(390, 1)

    expect(encabezadosDeDia()).toEqual(['Tue 3'])
    expect(tarjetas()[0]).toHaveTextContent('J-1019')
    expect(diasDeLaTira()).toHaveLength(7)
    expect(diasDeLaTira().map((boton) => within(boton).getByText(/^[A-Z][a-z]{2}$/).textContent)).toEqual(NOMBRES)
    expect(diaDeLaTira('Tue')).toHaveAttribute('aria-pressed', 'true')
  })

  it('la tira indica cuántas programaciones tiene cada día', async () => {
    await renderAppCon(390, 1)

    expect(within(diaDeLaTira('Mon')).getByLabelText('2 jobs')).toBeInTheDocument()
    expect(within(diaDeLaTira('Tue')).getByLabelText('1 job')).toBeInTheDocument()
    expect(within(diaDeLaTira('Thu')).getByLabelText('1 job')).toBeInTheDocument()
    expect(within(diaDeLaTira('Wed')).getByLabelText('0 jobs')).toBeInTheDocument()
  })

  it('escenario "Cambiar de día": tocar el jueves muestra las programaciones del jueves', async () => {
    await renderAppCon(390, 1)

    fireEvent.click(diaDeLaTira('Thu'))

    expect(encabezadosDeDia()).toEqual(['Thu 5'])
    expect(tarjetas()).toHaveLength(1)
    expect(tarjetas()[0]).toHaveTextContent('J-1029')
    expect(tarjetas()[0]).toHaveTextContent('Instalar lámparas')
    expect(diaDeLaTira('Thu')).toHaveAttribute('aria-pressed', 'true')
    expect(diaDeLaTira('Tue')).toHaveAttribute('aria-pressed', 'false')
  })

  it('tocar el lunes muestra sus dos programaciones y tocar el miércoles, ninguna', async () => {
    await renderAppCon(390, 1)

    fireEvent.click(diaDeLaTira('Mon'))
    expect(encabezadosDeDia()).toEqual(['Mon 2'])
    expect(tarjetas()).toHaveLength(2)

    fireEvent.click(diaDeLaTira('Wed'))
    expect(encabezadosDeDia()).toEqual(['Wed 4'])
    expect(tarjetas()).toHaveLength(0)
  })

  it('"Next week" muestra el primer día de esa semana (domingo 8) y "Today" vuelve al martes 3', async () => {
    await renderAppCon(390, 1)
    fireEvent.click(diaDeLaTira('Thu'))

    fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
    expect(encabezadosDeDia()).toEqual(['Sun 8'])
    expect(diaDeLaTira('Sun')).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(encabezadosDeDia()).toEqual(['Tue 3'])
    expect(diaDeLaTira('Tue')).toHaveAttribute('aria-pressed', 'true')
  })

  it('el catálogo y los empleados no se muestran hasta abrir su panel inferior, y no hay botones con aria-expanded', async () => {
    await renderAppCon(390, 1)

    expect(screen.queryByRole('heading', { level: 2, name: 'Jobs' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'Employees' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Jobs' })).not.toHaveAttribute('aria-expanded')
    expect(screen.getByRole('button', { name: 'Employees' })).not.toHaveAttribute('aria-expanded')
  })

  it('"Jobs" de la barra inferior abre el catálogo en un panel inferior y "Done" lo cierra', async () => {
    await renderAppCon(390, 1)

    fireEvent.click(screen.getByRole('button', { name: 'Jobs' }))

    const panel = screen.getByRole('dialog', { name: 'Jobs' })
    expect(within(panel).getByRole('searchbox', { name: 'Search jobs' })).toBeInTheDocument()
    await waitFor(() => expect(within(panel).getAllByRole('listitem')).toHaveLength(30))

    fireEvent.click(within(panel).getByRole('button', { name: 'Done' }))

    expect(screen.queryByRole('dialog', { name: 'Jobs' })).not.toBeInTheDocument()
  })

  it('"Employees" de la barra inferior abre los empleados en un panel inferior', async () => {
    await renderAppCon(390, 1)

    fireEvent.click(screen.getByRole('button', { name: 'Employees' }))

    const panel = screen.getByRole('dialog', { name: 'Employees' })
    await waitFor(() => expect(within(panel).getAllByRole('listitem')).toHaveLength(8))
  })

  it('el "+" de la tarjeta abre "Assign employees" sin abrir el detalle', async () => {
    await renderAppCon(390, 1)
    fireEvent.click(diaDeLaTira('Mon'))
    await waitFor(() => expect(within(tarjetas()[0]).getAllByTitle(/López|Martínez/)).toHaveLength(2))

    fireEvent.click(within(tarjetas()[0]).getByRole('button', { name: 'Assign employees' }))

    const panel = screen.getByRole('dialog', { name: 'Assign employees' })
    expect(within(panel).getByRole('checkbox', { name: 'Ana López' })).toBeChecked()
    expect(within(panel).getByRole('checkbox', { name: 'Luis Martínez' })).toBeChecked()
    expect(screen.queryByRole('dialog', { name: 'J-1024 Pintar oficina' })).not.toBeInTheDocument()
  })

  it('marcar a Pedro en "Assign employees" lo muestra en la tarjeta del lunes', async () => {
    await renderAppCon(390, 1)
    fireEvent.click(diaDeLaTira('Mon'))
    await waitFor(() => expect(within(tarjetas()[0]).getAllByTitle(/López|Martínez/)).toHaveLength(2))
    fireEvent.click(within(tarjetas()[0]).getByRole('button', { name: 'Assign employees' }))

    fireEvent.click(screen.getByRole('checkbox', { name: 'Pedro Sánchez' }))

    await waitFor(() => expect(within(tarjetas()[0]).getByTitle('Pedro Sánchez')).toHaveTextContent('PS'))
  })

  it('tocar la tarjeta fuera del "+" abre su detalle', async () => {
    await renderAppCon(390, 1)

    fireEvent.click(tarjetas()[0])

    expect(screen.getByRole('dialog', { name: 'J-1019 Cambiar ventanas' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Assign employees' })).not.toBeInTheDocument()
  })
})

describe('App al cambiar el ancho con la página abierta', () => {
  it('de 1280 a 390 px pasa del tablero de siete días a un solo día con la tira, y vuelve al ensanchar', async () => {
    await renderAppCon(1280, 4)
    expect(encabezadosDeDia()).toHaveLength(7)
    expect(screen.getByRole('heading', { level: 2, name: 'Jobs' })).toBeInTheDocument()

    act(() => simularAncho(390))

    expect(encabezadosDeDia()).toEqual(['Tue 3'])
    expect(diasDeLaTira()).toHaveLength(7)
    expect(screen.queryByRole('heading', { level: 2, name: 'Jobs' })).not.toBeInTheDocument()

    act(() => simularAncho(1280))

    expect(encabezadosDeDia()).toHaveLength(7)
    expect(diasDeLaTira()).toHaveLength(0)
    expect(screen.getByRole('heading', { level: 2, name: 'Jobs' })).toBeInTheDocument()
  })
})
