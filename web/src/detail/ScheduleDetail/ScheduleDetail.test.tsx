// Tests del panel de detalle de una programación (tarea 8.1 de `schedule-assign`) con `msw/node`.
//
// Cubren de `specs/weekly-schedule-board/spec.md` los requisitos "Solo hora de inicio"
// (escenario "Editar la hora de inicio": a 10:30, la tarjeta lo muestra y se reordena en su
// día), "Duplicar una programación" (escenario "Duplicar desde el detalle en el mismo día"),
// "Mover una programación a otro día" (con "Move to") y "Quitar una programación"; y de
// `specs/employee-assignment/spec.md`, "Retirar un empleado de una programación" (desde el
// detalle) y "Empleados que pasan a inactivos" (el detalle lo marca como inactivo). También
// cubren "Comentario de una programación" (tarea 12.2) y "Duplicar no copia el comentario", y
// "Cerrar el detalle de una programación" (tarea 14.1): click fuera cierra, click dentro no,
// guardar lo que se editaba antes de cerrar, click en otra tarjeta y "Undo" cierra el detalle.
//
// Se monta la aplicación completa: el detalle se abre al pulsar una tarjeta y sus cambios se
// comprueban en el tablero y en las peticiones que llegan al servidor.
//
// La fecha del sistema se fija en el martes 2026-11-03. La semilla programa esa semana:
// - lunes 2: "J-1024 Pintar oficina" (id 1) a las 07:00 con Ana López y Luis Martínez y el
//   comentario "Llevar escalera", y otra (id 2) a las 08:00 con Ana y sin comentario;
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
import { UndoProvider } from '../../undo/UndoProvider'
import { ScheduleDetail } from './ScheduleDetail'

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
    http.post('/v2/job-management/schedules', anotar),
    http.patch('/v2/job-management/schedules/:id', anotar),
    http.delete('/v2/job-management/schedules/:id', anotar),
    http.put('/v2/job-management/schedules/:id/employees', anotar),
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
  Array.from(elemento.querySelectorAll('[title]:not([aria-label^="Comment:"])')).map((item) => item.textContent)

/** Pulsa la tarjeta y devuelve el panel de detalle que abre. */
function abrirDetalle(elemento: HTMLElement, nombre: string): HTMLElement {
  fireEvent.click(elemento)
  return screen.getByRole('dialog', { name: nombre })
}

const campoHora = (detalle: HTMLElement) => within(detalle).getByLabelText('Start time') as HTMLInputElement

const campoComentario = (detalle: HTMLElement) => within(detalle).getByLabelText('Comment') as HTMLTextAreaElement

/** Icono de comentario de una tarjeta, o `null` si no lo tiene. */
const iconoComentario = (elemento: HTMLElement) => within(elemento).queryByLabelText(/^Comment: /)

/** Espera un momento y comprueba que no se envió ninguna petición de cambio. */
async function sinPeticiones() {
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(peticiones).toEqual([])
}

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
        expect(peticiones).toEqual([{ metodo: 'PATCH', ruta: '/v2/job-management/schedules/1', cuerpo: { startTime: '10:30' } }]),
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
        expect(peticiones).toEqual([{ metodo: 'PATCH', ruta: '/v2/job-management/schedules/1', cuerpo: { startTime: '10:30' } }]),
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

  describe('comentario', () => {
    it('el campo "Comment" va debajo de "Start time" y muestra el comentario de la programación', async () => {
      await renderApp()
      const detalle = abrirDetalle(tarjeta('Mon', '07:00'), 'J-1024 Pintar oficina')

      const campo = campoComentario(detalle)
      expect(campo.tagName).toBe('TEXTAREA')
      expect(campo).toHaveValue('Llevar escalera')
      expect(campoHora(detalle).compareDocumentPosition(campo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('sin comentario el campo aparece vacío', async () => {
      await renderApp()
      const detalle = abrirDetalle(tarjeta('Mon', '08:00'), 'J-1024 Pintar oficina')

      expect(campoComentario(detalle)).toHaveValue('')
    })

    it('escenario "Agregar un comentario": escribir "Llevar escalera" y salir del campo lo guarda y la tarjeta muestra el icono', async () => {
      await renderApp()
      expect(iconoComentario(tarjeta('Mon', '08:00'))).toBeNull()
      const detalle = abrirDetalle(tarjeta('Mon', '08:00'), 'J-1024 Pintar oficina')

      fireEvent.change(campoComentario(detalle), { target: { value: 'Llevar escalera' } })
      fireEvent.blur(campoComentario(detalle))

      await waitFor(() =>
        expect(peticiones).toEqual([
          { metodo: 'PATCH', ruta: '/v2/job-management/schedules/2', cuerpo: { scheduleComment: 'Llevar escalera' } },
        ]),
      )
      await waitFor(() => expect(iconoComentario(tarjeta('Mon', '08:00'))).toHaveAttribute('title', 'Llevar escalera'))
      expect(iconoComentario(tarjeta('Mon', '08:00'))).toHaveAccessibleName('Comment: Llevar escalera')
      expect(await screen.findByText('Comment updated')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
      expect(campoComentario(screen.getByRole('dialog'))).toHaveValue('Llevar escalera')
    })

    it('escribir no envía nada hasta salir del campo, y Enter no lo guarda', async () => {
      await renderApp()
      const detalle = abrirDetalle(tarjeta('Mon', '08:00'), 'J-1024 Pintar oficina')
      const campo = campoComentario(detalle)

      act(() => campo.focus())
      fireEvent.change(campo, { target: { value: 'Llevar escalera' } })
      fireEvent.keyDown(campo, { key: 'Enter' })

      await sinPeticiones()
      expect(campo).toHaveFocus()
    })

    it('guarda un comentario de varias líneas tal cual', async () => {
      await renderApp()
      const detalle = abrirDetalle(tarjeta('Mon', '08:00'), 'J-1024 Pintar oficina')

      fireEvent.change(campoComentario(detalle), { target: { value: 'Llevar escalera\nY rodillos' } })
      fireEvent.blur(campoComentario(detalle))

      await waitFor(() =>
        expect(peticiones).toEqual([
          { metodo: 'PATCH', ruta: '/v2/job-management/schedules/2', cuerpo: { scheduleComment: 'Llevar escalera\nY rodillos' } },
        ]),
      )
      await waitFor(() =>
        expect(iconoComentario(tarjeta('Mon', '08:00'))).toHaveAttribute('title', 'Llevar escalera\nY rodillos'),
      )
    })

    it.each([
      ['vaciar', ''],
      ['dejar solo espacios en', '   '],
    ])('escenario "Borrar el comentario": %s el campo y salir envía null y la tarjeta deja de mostrar el icono', async (_accion, texto) => {
      await renderApp()
      expect(iconoComentario(tarjeta('Mon', '07:00'))).not.toBeNull()
      const detalle = abrirDetalle(tarjeta('Mon', '07:00'), 'J-1024 Pintar oficina')

      fireEvent.change(campoComentario(detalle), { target: { value: texto } })
      fireEvent.blur(campoComentario(detalle))

      await waitFor(() =>
        expect(peticiones).toEqual([{ metodo: 'PATCH', ruta: '/v2/job-management/schedules/1', cuerpo: { scheduleComment: null } }]),
      )
      await waitFor(() => expect(iconoComentario(tarjeta('Mon', '07:00'))).toBeNull())
      expect(campoComentario(screen.getByRole('dialog'))).toHaveValue('')
      expect(await screen.findByText('Comment updated')).toBeInTheDocument()
    })

    it('escenario "Salir sin cambios": entrar y salir del campo con comentario no envía nada', async () => {
      await renderApp()
      const detalle = abrirDetalle(tarjeta('Mon', '07:00'), 'J-1024 Pintar oficina')
      const campo = campoComentario(detalle)

      act(() => campo.focus())
      fireEvent.blur(campo)

      await sinPeticiones()
      expect(screen.queryByText('Comment updated')).not.toBeInTheDocument()
      expect(iconoComentario(tarjeta('Mon', '07:00'))).toHaveAttribute('title', 'Llevar escalera')
    })

    it('salir sin cambios de un campo vacío, o dejar solo espacios donde no había comentario, no envía nada', async () => {
      await renderApp()
      const detalle = abrirDetalle(tarjeta('Mon', '08:00'), 'J-1024 Pintar oficina')

      fireEvent.blur(campoComentario(detalle))
      fireEvent.change(campoComentario(detalle), { target: { value: '   ' } })
      fireEvent.blur(campoComentario(detalle))

      await sinPeticiones()
      expect(iconoComentario(tarjeta('Mon', '08:00'))).toBeNull()
    })

    it('al abrir otra programación el campo muestra el comentario de esa', async () => {
      await renderApp()
      abrirDetalle(tarjeta('Mon', '07:00'), 'J-1024 Pintar oficina')
      expect(campoComentario(screen.getByRole('dialog'))).toHaveValue('Llevar escalera')

      fireEvent.click(tarjeta('Mon', '08:00'))

      await waitFor(() => expect(campoComentario(screen.getByRole('dialog'))).toHaveValue(''))
      expect(peticiones).toEqual([])
    })
  })

  describe('"Duplicate"', () => {
    it('escenario "Duplicar no copia el comentario": la copia no tiene comentario y la original conserva "Llevar escalera"', async () => {
      semilla.schedules = semilla.schedules.filter((programacion) => programacion.jobSchedulesId !== 2)
      await renderApp(3)
      const detalle = abrirDetalle(tarjeta('Mon', '07:00'), 'J-1024 Pintar oficina')

      fireEvent.click(within(detalle).getByRole('button', { name: 'Duplicate' }))

      await waitFor(() => expect(tarjetasDelDia('Mon')).toHaveLength(2))
      await waitFor(() => expect(peticiones).toHaveLength(1))
      expect(peticiones[0].cuerpo).not.toHaveProperty('scheduleComment')
      await screen.findByText('Job duplicated')
      expect(iconoComentario(tarjeta('Mon', '08:00'))).toBeNull()
      expect(iconoComentario(tarjeta('Mon', '07:00'))).toHaveAttribute('title', 'Llevar escalera')
      expect(campoComentario(screen.getByRole('dialog'))).toHaveValue('Llevar escalera')
    })

    it('escenario "Duplicar desde el detalle en el mismo día": "J-1024" (07:00) del lunes tiene una segunda a las 08:00', async () => {
      // El lunes solo tiene "J-1024 Pintar oficina" a las 07:00, con Ana y Luis.
      semilla.schedules = semilla.schedules.filter((programacion) => programacion.jobSchedulesId !== 2)
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
            ruta: '/v2/job-management/schedules',
            cuerpo: { jobsId: 7, date: LUNES, startTime: '08:00', employeesIds: [3, 5] },
          },
        ]),
      )
      // El detalle sigue abierto en la original.
      expect(campoHora(screen.getByRole('dialog', { name: 'J-1024 Pintar oficina' }))).toHaveValue('07:00')
      expect(await screen.findByText('Job duplicated')).toBeInTheDocument()
    })

    it('la copia no lleva a los empleados inactivos', async () => {
      semilla.schedules.push({ jobSchedulesId: 10, job: semilla.jobs[13], date: MIERCOLES, startTime: '07:00', employeesIds: [3, 9], scheduleComment: null })
      await renderApp(5)
      const detalle = abrirDetalle(tarjeta('Wed', 'J-1031'), 'J-1031 Jardín Pérez')

      fireEvent.click(within(detalle).getByRole('button', { name: 'Duplicate' }))

      await waitFor(() => expect(tarjetasDelDia('Wed')).toHaveLength(2))
      expect(iniciales(tarjeta('Wed', '08:00'))).toEqual(['AL'])
      await waitFor(() =>
        expect(peticiones).toEqual([
          {
            metodo: 'POST',
            ruta: '/v2/job-management/schedules',
            cuerpo: { jobsId: 14, date: MIERCOLES, startTime: '08:00', employeesIds: [3] },
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
        { metodo: 'PATCH', ruta: '/v2/job-management/schedules/1', cuerpo: { date: JUEVES, startTime: '07:00' } },
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
      expect(peticiones).toEqual([{ metodo: 'DELETE', ruta: '/v2/job-management/schedules/4', cuerpo: null }]),
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
          { metodo: 'PUT', ruta: '/v2/job-management/schedules/1/employees', cuerpo: { employeesIds: [5] } },
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
      semilla.schedules.push({ jobSchedulesId: 10, job: semilla.jobs[13], date: MIERCOLES, startTime: '07:00', employeesIds: [3, 9], scheduleComment: null })
      await renderApp(5)
      const detalle = abrirDetalle(tarjeta('Wed', 'J-1031'), 'J-1031 Jardín Pérez')

      expect(within(detalle).getByText('Raúl Torres (inactive)')).toBeInTheDocument()
      expect(within(detalle).getByText('Ana López')).toBeInTheDocument()
      expect(within(detalle).queryByText('Ana López (inactive)')).not.toBeInTheDocument()

      fireEvent.click(within(detalle).getByRole('button', { name: 'Remove Raúl Torres' }))

      await waitFor(() =>
        expect(peticiones).toEqual([
          { metodo: 'PUT', ruta: '/v2/job-management/schedules/10/employees', cuerpo: { employeesIds: [3] } },
        ]),
      )
      await waitFor(() =>
        expect(within(screen.getByRole('dialog')).queryByText('Raúl Torres (inactive)')).not.toBeInTheDocument(),
      )
      expect(iniciales(tarjeta('Wed', 'J-1031'))).toEqual(['AL'])
    })
  })
})

// Tarea 14.1: requisito "Cerrar el detalle de una programación".
describe('ScheduleDetail: cerrar el detalle', () => {
  const DIAS = ['2026-11-01', LUNES, '2026-11-03', MIERCOLES, JUEVES, '2026-11-06', '2026-11-07']

  /**
   * Monta solo el detalle de la programación `id` de la semilla, con un título fuera del panel,
   * y devuelve el panel, el espía de `onClose` y el elemento de fuera.
   */
  function renderDetalle(id = 1) {
    prepararServidor()
    const onClose = vi.fn()
    const porId = new Map(semilla.employees.map((empleado) => [empleado.employeesId, empleado]))
    const resultado = render(
      <QueryClientProvider client={client}>
        <UndoProvider>
          <h1>Tablero</h1>
          <ScheduleDetail scheduleId={id} schedules={semilla.schedules} days={DIAS} employeesById={porId} onClose={onClose} />
        </UndoProvider>
      </QueryClientProvider>,
    )
    return {
      detalle: screen.getByRole('dialog', { name: 'J-1024 Pintar oficina' }),
      onClose,
      fuera: screen.getByRole('heading', { level: 1, name: 'Tablero' }),
      unmount: resultado.unmount,
    }
  }

  /**
   * Hace click en `destino` con el orden de eventos del navegador: al pulsar, el foco sale del
   * campo que lo tenía (su `blur` se dispara antes del `click`).
   */
  function clickComoNavegador(destino: HTMLElement) {
    fireEvent.mouseDown(destino)
    act(() => (document.activeElement as HTMLElement | null)?.blur())
    fireEvent.mouseUp(destino)
    fireEvent.click(destino)
  }

  describe('con el componente solo', () => {
    it('un click fuera del panel llama a onClose una vez', () => {
      const { onClose, fuera } = renderDetalle()

      fireEvent.click(fuera)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('un click en el cuerpo del documento también llama a onClose', () => {
      const { onClose } = renderDetalle()

      fireEvent.click(document.body)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('los clicks dentro del panel no llaman a onClose: panel, título, fecha, hora, comentario, "Move to" y sus opciones', () => {
      const { detalle, onClose } = renderDetalle()

      fireEvent.click(detalle)
      fireEvent.click(within(detalle).getByRole('heading', { name: 'Pintar oficina' }))
      fireEvent.click(within(detalle).getByText('Mon, Nov 2', { selector: 'div' }))
      fireEvent.click(campoHora(detalle))
      fireEvent.click(campoComentario(detalle))
      fireEvent.click(within(detalle).getByRole('combobox', { name: 'Move to' }))
      fireEvent.click(within(detalle).getAllByRole('option')[4])
      // Icono SVG dentro de la etiqueta "Move to…".
      fireEvent.click(within(detalle).getByText('Move to…').querySelector('svg') as SVGElement)

      expect(onClose).not.toHaveBeenCalled()
    })

    it('"Close" llama a onClose una sola vez (el click no cuenta además como click fuera)', () => {
      const { detalle, onClose } = renderDetalle()

      fireEvent.click(within(detalle).getByRole('button', { name: 'Close' }))

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('al desmontarse deja de escuchar los clicks del documento', () => {
      const { onClose, unmount } = renderDetalle()
      unmount()

      fireEvent.click(document.body)

      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe('en la aplicación', () => {
    it('escenario "Click fuera del panel": con el detalle de "J-1024" abierto, un click en el miércoles vacío lo cierra sin enviar nada', async () => {
      await renderApp()
      abrirDetalle(tarjeta('Mon', '07:00'), 'J-1024 Pintar oficina')
      expect(tarjetasDelDia('Wed')).toHaveLength(0)

      fireEvent.click(columnaDelDia('Wed'))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      await sinPeticiones()
    })

    it('un click en el panel de empleados o en el catálogo también lo cierra', async () => {
      await renderApp()
      abrirDetalle(tarjeta('Mon', '07:00'), 'J-1024 Pintar oficina')
      fireEvent.click(screen.getByRole('heading', { level: 2, name: 'Employees' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      abrirDetalle(tarjeta('Mon', '07:00'), 'J-1024 Pintar oficina')
      fireEvent.click(screen.getByRole('searchbox', { name: 'Search jobs' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('interactuar dentro (hora, "Comment", "Move to") no lo cierra', async () => {
      await renderApp()
      const detalle = abrirDetalle(tarjeta('Mon', '07:00'), 'J-1024 Pintar oficina')

      fireEvent.click(campoHora(detalle))
      fireEvent.click(campoComentario(detalle))
      fireEvent.click(within(detalle).getByRole('combobox', { name: 'Move to' }))

      expect(screen.getByRole('dialog', { name: 'J-1024 Pintar oficina' })).toBe(detalle)
    })

    it('escenario "Guardar al cerrar": escribir "Llevar andamio" en "Comment" y hacer click fuera guarda el comentario y cierra', async () => {
      await renderApp()
      const detalle = abrirDetalle(tarjeta('Mon', '07:00'), 'J-1024 Pintar oficina')
      const campo = campoComentario(detalle)
      act(() => campo.focus())
      fireEvent.change(campo, { target: { value: 'Llevar andamio' } })

      clickComoNavegador(columnaDelDia('Wed'))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      await waitFor(() =>
        expect(peticiones).toEqual([
          { metodo: 'PATCH', ruta: '/v2/job-management/schedules/1', cuerpo: { scheduleComment: 'Llevar andamio' } },
        ]),
      )
      await waitFor(() => expect(iconoComentario(tarjeta('Mon', '07:00'))).toHaveAttribute('title', 'Llevar andamio'))
      expect(await screen.findByText('Comment updated')).toBeInTheDocument()
    })

    it('cambiar la hora a 10:30 y hacer click fuera guarda la hora y cierra', async () => {
      await renderApp()
      const detalle = abrirDetalle(tarjeta('Mon', '07:00'), 'J-1024 Pintar oficina')
      const campo = campoHora(detalle)
      act(() => campo.focus())
      fireEvent.change(campo, { target: { value: '10:30' } })

      clickComoNavegador(columnaDelDia('Wed'))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      await waitFor(() =>
        expect(peticiones).toEqual([{ metodo: 'PATCH', ruta: '/v2/job-management/schedules/1', cuerpo: { startTime: '10:30' } }]),
      )
      await waitFor(() => expect(horasDelDia('Mon')).toEqual(['08:00', '10:30']))
    })

    it('escenario "Click en otra tarjeta": con el de las 07:00 abierto, click en la de las 08:00 muestra el detalle de las 08:00', async () => {
      await renderApp()
      abrirDetalle(tarjeta('Mon', '07:00'), 'J-1024 Pintar oficina')

      fireEvent.click(tarjeta('Mon', '08:00'))

      const dialogos = screen.getAllByRole('dialog')
      expect(dialogos).toHaveLength(1)
      expect(campoHora(dialogos[0])).toHaveValue('08:00')
      expect(campoComentario(dialogos[0])).toHaveValue('')
      expect(within(dialogos[0]).queryByText('Luis Martínez')).not.toBeInTheDocument()
      await sinPeticiones()
    })

    it('click en una tarjeta de otro día y otro trabajo muestra el detalle de esa', async () => {
      await renderApp()
      abrirDetalle(tarjeta('Mon', '07:00'), 'J-1024 Pintar oficina')

      fireEvent.click(tarjeta('Tue', 'J-1019'))

      const detalle = screen.getByRole('dialog', { name: 'J-1019 Cambiar ventanas' })
      expect(within(detalle).getByText('Carlos Ruiz')).toBeInTheDocument()
      expect(screen.queryByRole('dialog', { name: 'J-1024 Pintar oficina' })).not.toBeInTheDocument()
    })

    it('pulsar "Undo" en el aviso cierra el detalle y deshace el cambio', async () => {
      await renderApp()
      const detalle = abrirDetalle(tarjeta('Mon', '07:00'), 'J-1024 Pintar oficina')
      fireEvent.change(campoHora(detalle), { target: { value: '10:30' } })
      fireEvent.blur(campoHora(detalle))
      await screen.findByText('Start time changed')
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      await waitFor(() => expect(horasDelDia('Mon')).toEqual(['07:00', '08:00']))
    })
  })
})
