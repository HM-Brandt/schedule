// Tests de las ausencias en el tablero (tareas 4.3, 4.4, 4.5 y 5.1 de `employee-absences`) con
// `msw/node`.
//
// Cubren de `specs/employee-absences/spec.md` los requisitos "Marcar una ausencia arrastrando",
// "Diálogo de ausencia" (guardar y cancelar desde el tablero), "Desasignación al marcar una
// ausencia", "Una ausencia por empleado y día", "Quitar una ausencia", "Empleados ausentes no
// asignables" y "Deshacer ausencias"; de `specs/weekly-schedule-board/spec.md`, "Mover una
// programación a un día con empleados ausentes"; y de `design.md` las decisiones 5 y 6 (en
// particular, que al deshacer el DELETE de la ausencia va antes que los PUT y que el id viejo de
// una ausencia se reemplaza por el nuevo en la pila).
//
// Se monta el proveedor real dentro de `UndoProvider`, con las siete columnas, el panel de
// empleados y el aviso de deshacer; el arrastre se maneja con las acciones del gestor de
// @dnd-kit (ver `src/test/dnd.ts`). Los orígenes son `employee-{id}` (panel),
// `employee-{id}-in-{programación}` (chip de una tarjeta), `absence-{id}` (chip de una ausencia)
// y `schedule-{id}`; los destinos, `card-{id}`, `day-{fecha}` y `absences-{fecha}`.
//
// La fecha del sistema se fija en el martes 2026-11-03. La semilla programa esa semana:
// - lunes 2: "J-1024 Pintar oficina" (id 1) con Ana López (3) y Luis Martínez (5), y otra (id 2) con Ana;
// - martes 3: "J-1019 Cambiar ventanas" (id 3) con Carlos Ruiz (8);
// - jueves 5: "J-1029 Instalar lámparas" (id 4), sin empleados;
// y una ausencia (id 1) de Sofía Romero (7) el miércoles 4. Cada test añade las ausencias que
// necesita antes de montar (la siguiente ausencia que cree el servidor tendrá el id 2, o el
// siguiente al mayor que añada el test).
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { http } from 'msw'
import { setupServer } from 'msw/node'
import { useMemo } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEmployees, useWeekAbsences, useWeekSchedules } from '../api/queries'
import { createQueryClient } from '../api/queryClient'
import type { AbsenceType } from '../api/types'
import { WeekBoard } from '../board/WeekBoard'
import { EmployeePanel } from '../employees/EmployeePanel'
import { absencesByDay, schedulesByDay } from '../lib/selectors'
import { createHandlers } from '../mocks/handlers'
import { createSeed } from '../mocks/seed'
import { CapturadorDelGestor, arrastrar, empezarArrastre, soltarSobre, simularApisDeArrastre } from '../test/dnd'
import { UndoProvider } from '../undo/UndoProvider'
import { UndoToast } from '../undo/UndoToast'
import { useUndoShortcut } from '../undo/useUndoShortcut'
import { ScheduleDndProvider } from './ScheduleDndProvider'

simularApisDeArrastre()

const DIAS = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']
const LUNES = '2026-11-02'
const MARTES = '2026-11-03'
const MIERCOLES = '2026-11-04'
const JUEVES = '2026-11-05'

const ANA = 3
const LUIS = 5

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

/** Añade a la semilla una ausencia con el id y los datos indicados. */
function ausente(
  employeeAbsencesId: number,
  employeesId: number,
  date: string,
  absenceType: AbsenceType = 'Off',
  absenceComment: string | null = null,
) {
  semilla.absences.push({ employeeAbsencesId, employeesId, date, absenceType, absenceComment })
}

/** Registra los manejadores de la semilla y, delante, uno que anota cada petición de cambio y la deja pasar. */
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
    http.post('/v2/job-management/absences', anotar),
    http.delete('/v2/job-management/absences/:id', anotar),
    ...createHandlers(semilla),
  )
}

function AtajoDeshacer() {
  useUndoShortcut()
  return null
}

function Tablero() {
  const schedules = useWeekSchedules(DIAS[0], DIAS[6])
  const absences = useWeekAbsences(DIAS[0], DIAS[6])
  const employees = useEmployees()
  const employeesById = useMemo(
    () => new Map((employees.data ?? []).map((employee) => [employee.employeesId, employee])),
    [employees.data],
  )
  const byDay = useMemo(() => schedulesByDay(schedules.data ?? [], DIAS), [schedules.data])
  const absencesOfDay = useMemo(() => absencesByDay(absences.data ?? [], DIAS), [absences.data])

  return (
    <ScheduleDndProvider schedules={schedules.data ?? []} absences={absences.data ?? []}>
      <CapturadorDelGestor />
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
        days={DIAS}
        today={MARTES}
        hours={undefined}
      />
    </ScheduleDndProvider>
  )
}

/** Monta el tablero y espera a que carguen las programaciones, los empleados y las ausencias de la semilla. */
async function renderTablero() {
  prepararServidor()
  render(
    <QueryClientProvider client={client}>
      <UndoProvider>
        <AtajoDeshacer />
        <Tablero />
        <UndoToast />
      </UndoProvider>
    </QueryClientProvider>,
  )
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(4))
  await waitFor(() => expect(within(zona('Wed')).getByText('Sofía Romero')).toBeInTheDocument())
}

/** Columna del día con nombre abreviado `nombre` ("Mon"): su encabezado y sus tarjetas. */
function columnaDelDia(nombre: string): HTMLElement {
  const encabezado = screen.getByText(nombre).parentElement as HTMLElement
  return encabezado.parentElement as HTMLElement
}

const tarjetasDelDia = (nombre: string) => within(columnaDelDia(nombre)).queryAllByRole('article')

const tarjeta = (nombre: string, texto: string) =>
  tarjetasDelDia(nombre).find((elemento) => elemento.textContent?.includes(texto)) as HTMLElement

/** Iniciales de los empleados de una tarjeta, en orden. */
const iniciales = (elemento: HTMLElement) =>
  Array.from(elemento.querySelectorAll('span[title]:not([aria-label^="Comment:"])')).map((item) => item.textContent)

/** Zona "Absences" del día con nombre abreviado `nombre`. */
const zona = (nombre: string) => within(columnaDelDia(nombre)).getByText('Absences').parentElement as HTMLElement

/** Chip de la ausencia de `nombreCompleto` en la zona del día `nombre`. */
const chip = (nombre: string, nombreCompleto: string) =>
  within(zona(nombre)).getByText(nombreCompleto).parentElement as HTMLElement

const zonaVacia = (nombre: string) => expect(within(zona(nombre)).getByText('No absences')).toBeInTheDocument()

const dialogo = () => screen.queryByRole('dialog', { name: 'Mark absence' })

async function sinPeticiones() {
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(peticiones).toEqual([])
}

/** Guarda el diálogo abierto con el tipo y el comentario indicados. */
function guardarDialogo(tipo: AbsenceType, comentario?: string) {
  const abierto = screen.getByRole('dialog', { name: 'Mark absence' })
  fireEvent.click(within(abierto).getByRole('radio', { name: tipo }))
  if (comentario) fireEvent.change(within(abierto).getByLabelText('Comment'), { target: { value: comentario } })
  fireEvent.click(within(abierto).getByRole('button', { name: 'Save' }))
}

describe('ausencias: marcar arrastrando', () => {
  it('escenario "Soltar a Ana en Absences del martes": abre el diálogo de Ana para el martes sin guardar nada', async () => {
    await renderTablero()

    await arrastrar(`employee-${ANA}`, `absences-${MARTES}`)

    const abierto = await screen.findByRole('dialog', { name: 'Mark absence' })
    expect(within(abierto).getByText('Ana López · Tue, Nov 3')).toBeInTheDocument()
    await sinPeticiones()
    zonaVacia('Tue')
  })

  it('escenario "Soltar desde una tarjeta": Luis desde "J-1024 Pintar oficina" a Absences del lunes abre el diálogo de Luis para el lunes', async () => {
    await renderTablero()

    await arrastrar(`employee-${LUIS}-in-1`, `absences-${LUNES}`)

    const abierto = await screen.findByRole('dialog', { name: 'Mark absence' })
    expect(within(abierto).getByText('Luis Martínez · Mon, Nov 2')).toBeInTheDocument()
    await sinPeticiones()
    expect(iniciales(tarjeta('Mon', '07:00'))).toEqual(['AL', 'LM'])
  })

  it('"Cancel" no crea ninguna ausencia y las asignaciones de Ana no cambian', async () => {
    await renderTablero()
    await arrastrar(`employee-${ANA}`, `absences-${LUNES}`)
    const abierto = await screen.findByRole('dialog', { name: 'Mark absence' })

    fireEvent.click(within(abierto).getByRole('button', { name: 'Cancel' }))

    expect(dialogo()).not.toBeInTheDocument()
    await sinPeticiones()
    zonaVacia('Mon')
    expect(iniciales(tarjeta('Mon', '07:00'))).toEqual(['AL', 'LM'])
    expect(iniciales(tarjeta('Mon', '08:00'))).toEqual(['AL'])
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  })

  it('Escape cierra el diálogo sin guardar nada', async () => {
    await renderTablero()
    await arrastrar(`employee-${ANA}`, `absences-${LUNES}`)
    await screen.findByRole('dialog', { name: 'Mark absence' })

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(dialogo()).not.toBeInTheDocument()
    await sinPeticiones()
    zonaVacia('Mon')
  })

  it('con el arrastre cancelado sobre la zona no abre el diálogo', async () => {
    await renderTablero()

    await arrastrar(`employee-${ANA}`, `absences-${MARTES}`, { cancelado: true })

    expect(dialogo()).not.toBeInTheDocument()
    await sinPeticiones()
  })

  it('soltado fuera de cualquier destino no abre el diálogo', async () => {
    await renderTablero()

    await arrastrar(`employee-${ANA}`, null)

    expect(dialogo()).not.toBeInTheDocument()
    await sinPeticiones()
  })

  it('escenario "Guardar con tipo y comentario": POST con "Vacation" y "Viaje familiar"; la zona del martes muestra a Ana con ambos', async () => {
    await renderTablero()
    await arrastrar(`employee-${ANA}`, `absences-${MARTES}`)
    await screen.findByRole('dialog', { name: 'Mark absence' })

    guardarDialogo('Vacation', 'Viaje familiar')

    await waitFor(() =>
      expect(peticiones).toEqual([
        {
          metodo: 'POST',
          ruta: '/v2/job-management/absences',
          cuerpo: { employeesId: ANA, date: MARTES, absenceType: 'Vacation', absenceComment: 'Viaje familiar' },
        },
      ]),
    )
    expect(dialogo()).not.toBeInTheDocument()
    await waitFor(() => expect(within(zona('Tue')).getByText('Ana López')).toBeInTheDocument())
    expect(within(zona('Tue')).getByText('Vacation')).toBeInTheDocument()
    expect(chip('Tue', 'Ana López')).toHaveAttribute('title', 'Viaje familiar')
    expect(await screen.findByText('Absence marked')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
  })

  it('guardar sin elegir nada envía "Off" con comentario null', async () => {
    await renderTablero()
    await arrastrar(`employee-${ANA}`, `absences-${MARTES}`)
    const abierto = await screen.findByRole('dialog', { name: 'Mark absence' })

    fireEvent.click(within(abierto).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(peticiones).toHaveLength(1))
    expect(peticiones[0].cuerpo).toEqual({ employeesId: ANA, date: MARTES, absenceType: 'Off', absenceComment: null })
    await waitFor(() => expect(within(zona('Tue')).getByText('Off')).toBeInTheDocument())
  })
})

describe('ausencias: desasignación al marcar', () => {
  it('escenario "Ana en dos trabajos el lunes": sale de las dos tarjetas del lunes y sigue en la del martes', async () => {
    semilla.schedules[2].employeesIds = [8, ANA]
    await renderTablero()
    expect(iniciales(tarjeta('Tue', 'J-1019'))).toEqual(['CR', 'AL'])

    await arrastrar(`employee-${ANA}`, `absences-${LUNES}`)
    await screen.findByRole('dialog', { name: 'Mark absence' })
    guardarDialogo('Vacation')

    await waitFor(() => expect(iniciales(tarjeta('Mon', '07:00'))).toEqual(['LM']))
    expect(iniciales(tarjeta('Mon', '08:00'))).toEqual([])
    expect(within(tarjeta('Mon', '08:00')).getByText('No employees')).toBeInTheDocument()
    expect(iniciales(tarjeta('Tue', 'J-1019'))).toEqual(['CR', 'AL'])
    expect(within(zona('Mon')).getByText('Ana López')).toBeInTheDocument()
    // Una sola petición: la desasignación la hace el servidor en la misma operación.
    expect(peticiones.map((peticion) => `${peticion.metodo} ${peticion.ruta}`)).toEqual(['POST /v2/job-management/absences'])
  })
})

describe('ausencias: una por empleado y día', () => {
  it('escenario "Soltar dos veces": Ana ya ausente no abre el diálogo y la zona la muestra una sola vez', async () => {
    ausente(2, ANA, MARTES, 'Sick')
    await renderTablero()
    await waitFor(() => expect(within(zona('Tue')).getByText('Ana López')).toBeInTheDocument())

    await arrastrar(`employee-${ANA}`, `absences-${MARTES}`)

    expect(dialogo()).not.toBeInTheDocument()
    await sinPeticiones()
    expect(within(zona('Tue')).getAllByText('Ana López')).toHaveLength(1)
  })
})

describe('ausencias: quitar', () => {
  it('escenario "Arrastrar fuera": DELETE, la zona del lunes deja de mostrar a Ana y no aparece en ninguna tarjeta del lunes', async () => {
    semilla.schedules[0].employeesIds = [LUIS]
    semilla.schedules[1].employeesIds = []
    ausente(2, ANA, LUNES, 'Vacation', 'Viaje')
    await renderTablero()
    await waitFor(() => expect(within(zona('Mon')).getByText('Ana López')).toBeInTheDocument())
    await waitFor(() => expect(chip('Mon', 'Ana López')).toHaveAttribute('aria-disabled', 'false'))

    await arrastrar('absence-2', null)

    await waitFor(() =>
      expect(peticiones).toEqual([{ metodo: 'DELETE', ruta: '/v2/job-management/absences/2', cuerpo: null }]),
    )
    await waitFor(() => zonaVacia('Mon'))
    for (const unaTarjeta of tarjetasDelDia('Mon')) expect(iniciales(unaTarjeta)).not.toContain('AL')
    expect(await screen.findByText('Absence removed')).toBeInTheDocument()
  })

  it('soltarla en su propia zona no hace nada', async () => {
    ausente(2, ANA, MARTES, 'Sick')
    await renderTablero()
    await waitFor(() => expect(chip('Tue', 'Ana López')).toHaveAttribute('aria-disabled', 'false'))

    await arrastrar('absence-2', `absences-${MARTES}`)

    await sinPeticiones()
    expect(within(zona('Tue')).getAllByText('Ana López')).toHaveLength(1)
    expect(dialogo()).not.toBeInTheDocument()
  })

  it('con el arrastre cancelado fuera de la zona no la quita', async () => {
    ausente(2, ANA, MARTES, 'Sick')
    await renderTablero()
    await waitFor(() => expect(chip('Tue', 'Ana López')).toHaveAttribute('aria-disabled', 'false'))

    await arrastrar('absence-2', null, { cancelado: true })

    await sinPeticiones()
    expect(within(zona('Tue')).getByText('Ana López')).toBeInTheDocument()
  })
})

describe('ausencias: empleados ausentes no asignables', () => {
  it('escenario "Arrastrar a una ausente a una tarjeta de su día": la tarjeta no se resalta y al soltar Ana no queda asignada', async () => {
    semilla.schedules[0].employeesIds = [LUIS]
    semilla.schedules[1].employeesIds = []
    ausente(2, ANA, LUNES, 'Vacation')
    await renderTablero()
    await waitFor(() => expect(within(zona('Mon')).getByText('Ana López')).toBeInTheDocument())

    await empezarArrastre(`employee-${ANA}`)
    await waitFor(() => expect(tarjeta('Tue', 'J-1019')).toHaveClass(/accepting/))
    expect(tarjeta('Mon', '07:00')).not.toHaveClass(/accepting/)
    await soltarSobre('card-1')

    await sinPeticiones()
    expect(iniciales(tarjeta('Mon', '07:00'))).toEqual(['LM'])
    expect(tarjeta('Mon', '07:00')).not.toHaveClass(/over/)
  })

  it('escenario "Otro día sí se puede": Ana ausente el lunes suelta sobre la tarjeta del martes y queda asignada', async () => {
    semilla.schedules[0].employeesIds = [LUIS]
    semilla.schedules[1].employeesIds = []
    ausente(2, ANA, LUNES, 'Vacation')
    await renderTablero()
    await waitFor(() => expect(within(zona('Mon')).getByText('Ana López')).toBeInTheDocument())

    await arrastrar(`employee-${ANA}`, 'card-3')

    await waitFor(() =>
      expect(peticiones).toEqual([
        { metodo: 'PUT', ruta: '/v2/job-management/schedules/3/employees', cuerpo: { employeesIds: [8, ANA] } },
      ]),
    )
    await waitFor(() => expect(iniciales(tarjeta('Tue', 'J-1019'))).toEqual(['CR', 'AL']))
  })

  it('un empleado que no está ausente sí se asigna a las tarjetas del lunes', async () => {
    ausente(2, ANA, LUNES, 'Vacation')
    semilla.schedules[0].employeesIds = [LUIS]
    semilla.schedules[1].employeesIds = []
    await renderTablero()

    await arrastrar('employee-8', 'card-1')

    await waitFor(() => expect(peticiones).toHaveLength(1))
    expect(peticiones[0].cuerpo).toEqual({ employeesIds: [LUIS, 8] })
  })

  it('Ana ausente el lunes, arrastrada desde su tarjeta del martes a una tarjeta del lunes: no hace nada', async () => {
    semilla.schedules[0].employeesIds = [LUIS]
    semilla.schedules[1].employeesIds = []
    semilla.schedules[2].employeesIds = [8, ANA]
    ausente(2, ANA, LUNES, 'Vacation')
    await renderTablero()

    await arrastrar(`employee-${ANA}-in-3`, 'card-2')

    await sinPeticiones()
    expect(iniciales(tarjeta('Tue', 'J-1019'))).toEqual(['CR', 'AL'])
  })
})

describe('ausencias: mover una programación a un día con ausentes', () => {
  const MENSAJE_LUIS = "Can't move the job. Absent on Thu, Nov 5: Luis Martínez."

  it('escenario "Mover a un día con un ausente": no envía nada, la tarjeta sigue en su día y el aviso nombra a Luis', async () => {
    ausente(2, LUIS, JUEVES, 'Sick')
    await renderTablero()

    await arrastrar('schedule-1', `day-${JUEVES}`)

    const aviso = await screen.findByRole('alert')
    expect(aviso.textContent).toContain(MENSAJE_LUIS)
    expect(aviso.textContent?.startsWith(MENSAJE_LUIS)).toBe(true)
    await sinPeticiones()
    expect(tarjetasDelDia('Mon')).toHaveLength(2)
    expect(tarjeta('Mon', '07:00')).toHaveTextContent('J-1024')
    expect(tarjetasDelDia('Thu')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  })

  it('con varios ausentes los nombra a todos separados por coma', async () => {
    ausente(2, LUIS, JUEVES, 'Sick')
    ausente(3, ANA, JUEVES, 'Off')
    await renderTablero()

    await arrastrar('schedule-1', `day-${JUEVES}`)

    const aviso = await screen.findByRole('alert')
    expect(aviso.textContent).toContain("Can't move the job. Absent on Thu, Nov 5: Ana López, Luis Martínez.")
    await sinPeticiones()
    expect(tarjetasDelDia('Mon')).toHaveLength(2)
  })

  it('si el ausente ese día no está en la tarjeta, la mueve con normalidad', async () => {
    await renderTablero()

    // Sofía Romero (7) está ausente el miércoles y no está en la tarjeta 1.
    await arrastrar('schedule-1', `day-${MIERCOLES}`)

    await waitFor(() =>
      expect(peticiones).toEqual([
        { metodo: 'PATCH', ruta: '/v2/job-management/schedules/1', cuerpo: { date: MIERCOLES, startTime: '07:00' } },
      ]),
    )
    await waitFor(() => expect(tarjetasDelDia('Wed')).toHaveLength(1))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('una tarjeta sin empleados se mueve a un día con ausentes', async () => {
    ausente(2, LUIS, JUEVES, 'Sick')
    await renderTablero()

    await arrastrar('schedule-4', `day-${MIERCOLES}`)

    await waitFor(() => expect(peticiones).toHaveLength(1))
    expect(peticiones[0].metodo).toBe('PATCH')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('ausencias: deshacer', () => {
  it('escenario "Deshacer una ausencia marcada": la zona del lunes deja de mostrar a Ana y vuelve a sus dos tarjetas', async () => {
    await renderTablero()
    await arrastrar(`employee-${ANA}`, `absences-${LUNES}`)
    await screen.findByRole('dialog', { name: 'Mark absence' })
    guardarDialogo('Vacation', 'Viaje familiar')
    await waitFor(() => expect(iniciales(tarjeta('Mon', '07:00'))).toEqual(['LM']))
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))

    await waitFor(() => zonaVacia('Mon'))
    await waitFor(() => expect(iniciales(tarjeta('Mon', '07:00'))).toEqual(['AL', 'LM']))
    expect(iniciales(tarjeta('Mon', '08:00'))).toEqual(['AL'])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('el DELETE de la ausencia va antes que los PUT de cada programación, con su conjunto anterior', async () => {
    await renderTablero()
    await arrastrar(`employee-${ANA}`, `absences-${LUNES}`)
    await screen.findByRole('dialog', { name: 'Mark absence' })
    guardarDialogo('Off')
    await waitFor(() => expect(iniciales(tarjeta('Mon', '07:00'))).toEqual(['LM']))
    peticiones.length = 0

    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))

    await waitFor(() => expect(peticiones).toHaveLength(3))
    expect(peticiones).toEqual([
      { metodo: 'DELETE', ruta: '/v2/job-management/absences/2', cuerpo: null },
      { metodo: 'PUT', ruta: '/v2/job-management/schedules/1/employees', cuerpo: { employeesIds: [ANA, LUIS] } },
      { metodo: 'PUT', ruta: '/v2/job-management/schedules/2/employees', cuerpo: { employeesIds: [ANA] } },
    ])
    // Con el orden correcto el servidor no rechaza los PUT (un 422 mostraría un aviso de error).
    await waitFor(() => expect(iniciales(tarjeta('Mon', '08:00'))).toEqual(['AL']))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('deshacer una ausencia marcada sin programaciones ese día solo envía el DELETE', async () => {
    await renderTablero()
    await arrastrar(`employee-${ANA}`, `absences-${MARTES}`)
    await screen.findByRole('dialog', { name: 'Mark absence' })
    guardarDialogo('Other')
    await waitFor(() => expect(within(zona('Tue')).getByText('Ana López')).toBeInTheDocument())
    peticiones.length = 0

    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }))

    await waitFor(() => zonaVacia('Tue'))
    expect(peticiones).toEqual([{ metodo: 'DELETE', ruta: '/v2/job-management/absences/2', cuerpo: null }])
  })

  it('escenario "Deshacer una ausencia quitada": Luis vuelve el miércoles con "Sick" y "Gripe" al pulsar Ctrl+Z', async () => {
    ausente(2, LUIS, MIERCOLES, 'Sick', 'Gripe')
    await renderTablero()
    await waitFor(() => expect(chip('Wed', 'Luis Martínez')).toHaveAttribute('aria-disabled', 'false'))
    await arrastrar('absence-2', null)
    await waitFor(() => expect(within(zona('Wed')).queryByText('Luis Martínez')).not.toBeInTheDocument())
    await screen.findByText('Absence removed')
    peticiones.length = 0

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })

    await waitFor(() =>
      expect(peticiones).toEqual([
        {
          metodo: 'POST',
          ruta: '/v2/job-management/absences',
          cuerpo: { employeesId: LUIS, date: MIERCOLES, absenceType: 'Sick', absenceComment: 'Gripe' },
        },
      ]),
    )
    await waitFor(() => expect(within(zona('Wed')).getByText('Luis Martínez')).toBeInTheDocument())
    expect(within(zona('Wed')).getByText('Sick')).toBeInTheDocument()
    expect(chip('Wed', 'Luis Martínez')).toHaveAttribute('title', 'Gripe')
    // La de Sofía sigue donde estaba.
    expect(within(zona('Wed')).getByText('Sofía Romero')).toBeInTheDocument()
  })

  it('tras recrear una ausencia quitada, deshacer la entrada anterior borra la ausencia con el id nuevo (replaceAbsenceId)', async () => {
    await renderTablero()
    // Entrada 1: marcar a Ana el martes (el servidor le da el id 2).
    await arrastrar(`employee-${ANA}`, `absences-${MARTES}`)
    await screen.findByRole('dialog', { name: 'Mark absence' })
    guardarDialogo('Sick', 'Gripe')
    await waitFor(() => expect(chip('Tue', 'Ana López')).toHaveAttribute('aria-disabled', 'false'))
    // Entrada 2: quitar esa ausencia.
    await arrastrar('absence-2', null)
    await waitFor(() => expect(within(zona('Tue')).queryByText('Ana López')).not.toBeInTheDocument())
    // Deshacer la entrada 2: se recrea con el id 3.
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    await waitFor(() => expect(chip('Tue', 'Ana López')).toHaveAttribute('aria-disabled', 'false'))
    peticiones.length = 0

    // Deshacer la entrada 1: tiene que borrar la ausencia 3, no la 2, que ya no existe.
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })

    await waitFor(() =>
      expect(peticiones).toEqual([{ metodo: 'DELETE', ruta: '/v2/job-management/absences/3', cuerpo: null }]),
    )
    await waitFor(() => zonaVacia('Tue'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
