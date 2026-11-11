// Tests de la página inicial (tareas 1.6, 5.1, 5.2 y 5.3 de `schedule-assign`) con `msw/node`.
//
// La fecha del sistema se fija en el martes 2026-11-03 a las 10:00 hora local. Solo se
// simula `Date`: los temporizadores siguen siendo reales para no interferir con React.
//
// La semilla de `web/src/mocks/seed.ts` para esa fecha programa en la semana del 1 al 7:
// - lunes 2: "J-1024 Pintar oficina" a las 07:00 (Ana López y Luis Martínez) y a las 08:00 (Ana);
// - martes 3: "J-1019 Cambiar ventanas" a las 07:00 (Carlos Ruiz);
// - jueves 5: "J-1029 Instalar lámparas" a las 09:30, sin empleados.
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createQueryClient } from './api/queryClient'
import type { Schedule } from './api/types'
import { createHandlers } from './mocks/handlers'
import { createSeed } from './mocks/seed'

const NOMBRES_DE_DIA = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/

const MENSAJE_500 = 'Fallo simulado del servidor'

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
  // Sin reintentos, para que los errores de carga se vean al momento.
  client.setDefaultOptions({ queries: { retry: false } })
})

afterEach(() => {
  client.clear()
  vi.useRealTimers()
})

afterAll(() => {
  server.close()
})

function renderApp() {
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  )
}

/** Encabezados de los días en el orden del tablero, como `"Sun 1"`, `"Mon 2"`… */
function diasVisibles(): string[] {
  return screen.getAllByText(NOMBRES_DE_DIA).map((nombre) => {
    const texto = (nombre.parentElement as HTMLElement).textContent ?? ''
    return texto.replace(/^([A-Za-z]{3})(\d+)$/, '$1 $2')
  })
}

/** Encabezados de día marcados como día actual. */
function diasResaltados(): HTMLElement[] {
  return screen
    .getAllByText(NOMBRES_DE_DIA)
    .map((nombre) => nombre.parentElement as HTMLElement)
    .filter((encabezado) => encabezado.getAttribute('aria-current') === 'date')
}

/** El rango de la semana es el `h2` que termina en el año; el otro `h2` es "Jobs" del catálogo. */
const rangoVisible = () => screen.getByRole('heading', { level: 2, name: /\d{4}$/ })

/** Columna del día con nombre abreviado `nombre` ("Mon"): su encabezado y sus tarjetas. */
function columnaDelDia(nombre: string): HTMLElement {
  const encabezado = screen.getByText(nombre).parentElement as HTMLElement
  return encabezado.parentElement as HTMLElement
}

const tarjetasDelDia = (nombre: string) => within(columnaDelDia(nombre)).queryAllByRole('article')

/** Sección que encabeza el `h2` con nombre `titulo`: "Jobs" (catálogo) o "Employees" (panel de empleados). */
const seccion = (titulo: string) =>
  screen.getByRole('heading', { level: 2, name: titulo }).closest('section') as HTMLElement

/** Lista de trabajos del catálogo; la página tiene también la lista del panel de empleados. */
const listaDelCatalogo = () => within(seccion('Jobs')).getByRole('list')

/** Elemento del catálogo cuyo número es `numero`, cuando ya cargó la lista de trabajos. */
async function trabajoDelCatalogo(numero: string): Promise<HTMLElement> {
  return (await within(listaDelCatalogo()).findByText(numero)).closest('li') as HTMLElement
}

/** Añade a la semilla una programación de "J-1031 Jardín Pérez" el martes 10 de la semana siguiente. */
function programarEnLaSemanaSiguiente() {
  semilla.schedules.push({
    jobSchedulesId: 50,
    job: semilla.jobs[13],
    date: '2026-11-10',
    startTime: '10:00',
    employeesIds: [1],
    scheduleComment: null,
  })
  server.resetHandlers(...createHandlers(semilla))
}

describe('App', () => {
  it('muestra el título "Weekly schedule" como encabezado principal', () => {
    renderApp()

    expect(screen.getByRole('heading', { level: 1, name: 'Weekly schedule' })).toBeInTheDocument()
  })

  describe('apertura el martes 2026-11-03', () => {
    it('el encabezado indica el rango "Nov 1 - 7, 2026"', () => {
      renderApp()

      expect(rangoVisible()).toHaveTextContent('Nov 1 - 7, 2026')
    })

    it('muestra los 7 días en orden de domingo 1 a sábado 7', () => {
      renderApp()

      expect(diasVisibles()).toEqual(['Sun 1', 'Mon 2', 'Tue 3', 'Wed 4', 'Thu 5', 'Fri 6', 'Sat 7'])
    })

    it('resalta solo el martes 3 como día actual', () => {
      renderApp()

      const resaltados = diasResaltados()
      expect(resaltados).toHaveLength(1)
      expect(within(resaltados[0]).getByText('Tue')).toBeInTheDocument()
      expect(within(resaltados[0]).getByText('3')).toBeInTheDocument()
    })

    it('muestra los botones "Previous week", "Today" y "Next week"', () => {
      renderApp()

      expect(screen.getByRole('button', { name: 'Previous week' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Next week' })).toBeInTheDocument()
    })
  })

  describe('navegación entre semanas', () => {
    it('"Next week" muestra del domingo 8 al sábado 14 sin ningún día resaltado', () => {
      renderApp()

      fireEvent.click(screen.getByRole('button', { name: 'Next week' }))

      expect(rangoVisible()).toHaveTextContent('Nov 8 - 14, 2026')
      expect(diasVisibles()).toEqual(['Sun 8', 'Mon 9', 'Tue 10', 'Wed 11', 'Thu 12', 'Fri 13', 'Sat 14'])
      expect(diasResaltados()).toHaveLength(0)
    })

    it('"Previous week" desde la semana actual muestra "Oct 25 - 31, 2026"', () => {
      renderApp()

      fireEvent.click(screen.getByRole('button', { name: 'Previous week' }))

      expect(rangoVisible()).toHaveTextContent('Oct 25 - 31, 2026')
      expect(diasVisibles()).toEqual(['Sun 25', 'Mon 26', 'Tue 27', 'Wed 28', 'Thu 29', 'Fri 30', 'Sat 31'])
      expect(diasResaltados()).toHaveLength(0)
    })

    it('"Next week" cuatro veces cruza de mes: "Nov 29 - Dec 5, 2026"', () => {
      renderApp()
      const siguiente = screen.getByRole('button', { name: 'Next week' })

      for (let vez = 0; vez < 4; vez++) {
        fireEvent.click(siguiente)
      }

      expect(rangoVisible()).toHaveTextContent('Nov 29 - Dec 5, 2026')
    })

    it('"Today" tras ir a la semana siguiente vuelve a "Nov 1 - 7, 2026" con el martes 3 resaltado', () => {
      renderApp()
      fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
      fireEvent.click(screen.getByRole('button', { name: 'Next week' }))

      fireEvent.click(screen.getByRole('button', { name: 'Today' }))

      expect(rangoVisible()).toHaveTextContent('Nov 1 - 7, 2026')
      const resaltados = diasResaltados()
      expect(resaltados).toHaveLength(1)
      expect(within(resaltados[0]).getByText('Tue')).toBeInTheDocument()
      expect(within(resaltados[0]).getByText('3')).toBeInTheDocument()
    })

    it('"Today" tras ir a la semana anterior vuelve a "Nov 1 - 7, 2026"', () => {
      renderApp()
      fireEvent.click(screen.getByRole('button', { name: 'Previous week' }))

      fireEvent.click(screen.getByRole('button', { name: 'Today' }))

      expect(rangoVisible()).toHaveTextContent('Nov 1 - 7, 2026')
      expect(diasVisibles()).toEqual(['Sun 1', 'Mon 2', 'Tue 3', 'Wed 4', 'Thu 5', 'Fri 6', 'Sat 7'])
    })

    it('"Today" en la semana actual la deja igual', () => {
      renderApp()

      fireEvent.click(screen.getByRole('button', { name: 'Today' }))

      expect(rangoVisible()).toHaveTextContent('Nov 1 - 7, 2026')
      expect(diasResaltados()).toHaveLength(1)
    })
  })

  describe('tarjetas de la semana visible', () => {
    it('cada programación de la semilla aparece en la columna de su día', async () => {
      renderApp()

      await waitFor(() => expect(tarjetasDelDia('Mon')).toHaveLength(2))
      const lunes = tarjetasDelDia('Mon')
      for (const tarjeta of lunes) {
        expect(tarjeta).toHaveTextContent('J-1024')
        expect(tarjeta).toHaveTextContent('Pintar oficina')
      }

      const martes = tarjetasDelDia('Tue')
      expect(martes).toHaveLength(1)
      expect(martes[0]).toHaveTextContent('J-1019')
      expect(martes[0]).toHaveTextContent('Cambiar ventanas')
      expect(martes[0]).toHaveTextContent('07:00')

      const jueves = tarjetasDelDia('Thu')
      expect(jueves).toHaveLength(1)
      expect(jueves[0]).toHaveTextContent('J-1029')
      expect(jueves[0]).toHaveTextContent('Instalar lámparas')
      expect(jueves[0]).toHaveTextContent('09:30')

      for (const dia of ['Sun', 'Wed', 'Fri', 'Sat']) {
        expect(tarjetasDelDia(dia)).toHaveLength(0)
      }
    })

    it('el lunes muestra la de las 07:00 antes que la de las 08:00', async () => {
      renderApp()

      await waitFor(() => expect(tarjetasDelDia('Mon')).toHaveLength(2))
      const [primera, segunda] = tarjetasDelDia('Mon')
      expect(primera).toHaveTextContent('07:00')
      expect(segunda).toHaveTextContent('08:00')
    })

    it('ordena por hora aunque el servidor las envíe desordenadas: 07:00, 08:00, 09:00', async () => {
      const pintar = semilla.jobs[6]
      const desordenadas: Schedule[] = [
        { jobSchedulesId: 1, job: pintar, date: '2026-11-02', startTime: '09:00', employeesIds: [], scheduleComment: null },
        { jobSchedulesId: 2, job: pintar, date: '2026-11-02', startTime: '07:00', employeesIds: [], scheduleComment: null },
        { jobSchedulesId: 3, job: pintar, date: '2026-11-02', startTime: '08:00', employeesIds: [], scheduleComment: null },
      ]
      server.use(http.get('/v1/schedules', () => HttpResponse.json(desordenadas)))
      renderApp()

      await waitFor(() => expect(tarjetasDelDia('Mon')).toHaveLength(3))
      const horas = tarjetasDelDia('Mon').map((tarjeta) => tarjeta.textContent?.match(/\d{2}:\d{2}/)?.[0])
      expect(horas).toEqual(['07:00', '08:00', '09:00'])
    })

    it('la misma hora se ordena por orden de creación', async () => {
      const pintar = semilla.jobs[6]
      const jardin = semilla.jobs[13]
      server.use(
        http.get('/v1/schedules', () =>
          HttpResponse.json([
            { jobSchedulesId: 9, job: jardin, date: '2026-11-02', startTime: '07:00', employeesIds: [] },
            { jobSchedulesId: 4, job: pintar, date: '2026-11-02', startTime: '07:00', employeesIds: [] },
          ]),
        ),
      )
      renderApp()

      await waitFor(() => expect(tarjetasDelDia('Mon')).toHaveLength(2))
      const [primera, segunda] = tarjetasDelDia('Mon')
      expect(primera).toHaveTextContent('J-1024')
      expect(segunda).toHaveTextContent('J-1031')
    })

    it('la tarjeta del lunes a las 07:00 muestra las iniciales de Ana y Luis con su nombre completo', async () => {
      renderApp()

      await waitFor(() => expect(within(columnaDelDia('Mon')).getAllByTitle('Ana López')).toHaveLength(2))
      const [primera] = tarjetasDelDia('Mon')
      expect(within(primera).getByTitle('Ana López')).toHaveTextContent('AL')
      expect(within(primera).getByTitle('Luis Martínez')).toHaveTextContent('LM')
    })

    it('mientras cargan los empleados la tarjeta del lunes no indica "No employees"; al cargar, muestra sus iniciales', async () => {
      // `GET /v1/employee` queda retenido hasta que el test lo libera.
      let liberarEmpleados!: () => void
      const empleadosRetenidos = new Promise<void>((resolve) => {
        liberarEmpleados = resolve
      })
      server.use(
        http.get('/v1/employee', async () => {
          await empleadosRetenidos
          return HttpResponse.json(semilla.employees)
        }),
      )
      renderApp()

      await waitFor(() => expect(tarjetasDelDia('Mon')).toHaveLength(2))
      const [primera] = tarjetasDelDia('Mon')
      expect(within(primera).queryByText('No employees')).not.toBeInTheDocument()
      expect(within(primera).queryByTitle('Ana López')).not.toBeInTheDocument()

      liberarEmpleados()

      expect(await within(primera).findByTitle('Ana López')).toHaveTextContent('AL')
      expect(within(primera).getByTitle('Luis Martínez')).toHaveTextContent('LM')
      expect(within(primera).queryByText('No employees')).not.toBeInTheDocument()
    })

    it('la tarjeta del jueves sin empleados indica "No employees"', async () => {
      renderApp()

      await waitFor(() => expect(tarjetasDelDia('Thu')).toHaveLength(1))
      expect(within(tarjetasDelDia('Thu')[0]).getByText('No employees')).toBeInTheDocument()
    })

    it('ninguna tarjeta muestra hora de fin', async () => {
      renderApp()

      await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(4))
      for (const tarjeta of screen.getAllByRole('article')) {
        const texto = tarjeta.textContent ?? ''
        expect(texto.match(/\d{2}:\d{2}/g)).toHaveLength(1)
        expect(texto).not.toMatch(/\d{2}:\d{2}\s*[-–]\s*\d{2}:\d{2}/)
      }
    })

    it('"Next week" muestra las programaciones de la semana siguiente y ninguna de la actual', async () => {
      programarEnLaSemanaSiguiente()
      renderApp()
      await waitFor(() => expect(tarjetasDelDia('Mon')).toHaveLength(2))

      fireEvent.click(screen.getByRole('button', { name: 'Next week' }))

      await waitFor(() => expect(tarjetasDelDia('Tue')).toHaveLength(1))
      const [martes10] = tarjetasDelDia('Tue')
      expect(martes10).toHaveTextContent('J-1031')
      expect(martes10).toHaveTextContent('Jardín Pérez')
      expect(martes10).toHaveTextContent('10:00')
      expect(within(martes10).getByTitle('Marta Gómez')).toHaveTextContent('MG')
      expect(screen.getAllByRole('article')).toHaveLength(1)
      for (const tarjeta of screen.getAllByRole('article')) {
        expect(tarjeta).not.toHaveTextContent('J-1024')
      }
    })

    it('"Previous week" a una semana sin programaciones no muestra tarjetas', async () => {
      renderApp()
      await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(4))

      fireEvent.click(screen.getByRole('button', { name: 'Previous week' }))

      await waitFor(() => expect(screen.queryAllByRole('article')).toHaveLength(0))
      expect(rangoVisible()).toHaveTextContent('Oct 25 - 31, 2026')
    })

    it('"Today" tras "Next week" vuelve a mostrar las programaciones de la semana actual', async () => {
      programarEnLaSemanaSiguiente()
      renderApp()
      fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
      await waitFor(() => expect(tarjetasDelDia('Tue')).toHaveLength(1))

      fireEvent.click(screen.getByRole('button', { name: 'Today' }))

      await waitFor(() => expect(tarjetasDelDia('Mon')).toHaveLength(2))
      expect(screen.getAllByRole('article')).toHaveLength(4)
    })

    it('con un 500 en GET /v1/schedules muestra el aviso "Couldn\'t load the week." con el detalle', async () => {
      server.use(
        http.get('/v1/schedules', () => HttpResponse.json({ error: MENSAJE_500 }, { status: 500 })),
      )
      renderApp()

      const aviso = await screen.findByRole('alert')
      expect(aviso).toHaveTextContent(`Couldn't load the week. ${MENSAJE_500}`)
      expect(diasVisibles()).toHaveLength(7)
      expect(screen.queryAllByRole('article')).toHaveLength(0)
    })
  })

  describe('catálogo de trabajos en la página', () => {
    it('muestra el catálogo "Jobs" con todos los trabajos de la semilla', async () => {
      renderApp()

      expect(screen.getByRole('heading', { level: 2, name: 'Jobs' })).toBeInTheDocument()
      await waitFor(() => expect(within(listaDelCatalogo()).getAllByRole('listitem')).toHaveLength(30))
    })

    it('un trabajo programado en la semana sigue en el catálogo', async () => {
      renderApp()

      await waitFor(() => expect(tarjetasDelDia('Mon')).toHaveLength(2))
      const pintar = await trabajoDelCatalogo('J-1024')
      expect(pintar).toBeVisible()
      expect(pintar).toHaveTextContent('Pintar oficina')
    })

    it('J-1024, programado dos veces en la semana, aparece atenuado con "x2"', async () => {
      renderApp()

      const pintar = await trabajoDelCatalogo('J-1024')
      await waitFor(() => expect(pintar).toHaveAttribute('data-in-use', 'true'))
      expect(within(pintar).getByText('x2')).toBeInTheDocument()
    })

    it('J-1019, programado una vez, aparece atenuado con "x1"', async () => {
      renderApp()

      const ventanas = await trabajoDelCatalogo('J-1019')
      await waitFor(() => expect(ventanas).toHaveAttribute('data-in-use', 'true'))
      expect(within(ventanas).getByText('x1')).toBeInTheDocument()
    })

    it('un trabajo sin programación en la semana tiene su tono normal y ningún contador', async () => {
      renderApp()

      const pintar = await trabajoDelCatalogo('J-1024')
      await waitFor(() => expect(pintar).toHaveAttribute('data-in-use', 'true'))
      const tejado = await trabajoDelCatalogo('J-1018')
      expect(tejado).not.toHaveAttribute('data-in-use')
      expect(within(tejado).queryByText(/^x\d+$/)).not.toBeInTheDocument()
    })

    it('al pasar a una semana sin J-1024 vuelve a su tono normal y sin contador', async () => {
      programarEnLaSemanaSiguiente()
      renderApp()
      const pintar = await trabajoDelCatalogo('J-1024')
      await waitFor(() => expect(pintar).toHaveAttribute('data-in-use', 'true'))

      fireEvent.click(screen.getByRole('button', { name: 'Next week' }))

      const jardin = await trabajoDelCatalogo('J-1031')
      await waitFor(() => expect(jardin).toHaveAttribute('data-in-use', 'true'))
      expect(within(jardin).getByText('x1')).toBeInTheDocument()
      expect(pintar).not.toHaveAttribute('data-in-use')
      expect(within(pintar).queryByText(/^x\d+$/)).not.toBeInTheDocument()
    })
  })

  // Tarea 7.1: "Panel de empleados activos" de `specs/employee-assignment/spec.md`. La semilla
  // tiene 8 empleados activos y 2 inactivos (Raúl Torres y Lucía Navarro).
  describe('panel de empleados en la página', () => {
    it('muestra "Employees" en una columna lateral con los 8 activos y sin los inactivos', async () => {
      renderApp()

      const panel = seccion('Employees')
      expect(panel.closest('aside')).not.toBeNull()
      await waitFor(() => expect(within(panel).getAllByRole('listitem')).toHaveLength(8))
      expect(within(panel).getByText('Ana López')).toBeInTheDocument()
      expect(within(panel).queryByText('Raúl Torres')).not.toBeInTheDocument()
      expect(within(panel).queryByText('Lucía Navarro')).not.toBeInTheDocument()
    })

    it('con un 500 en GET /v1/employee muestra "Couldn\'t load employees." con el detalle', async () => {
      server.use(
        http.get('/v1/employee', () => HttpResponse.json({ error: MENSAJE_500 }, { status: 500 })),
      )
      renderApp()

      const aviso = await within(seccion('Employees')).findByRole('alert')
      expect(aviso).toHaveTextContent(`Couldn't load employees. ${MENSAJE_500}`)
      expect(within(seccion('Employees')).queryAllByRole('listitem')).toHaveLength(0)
    })
  })
})
