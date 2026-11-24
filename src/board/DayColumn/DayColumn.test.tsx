// Tests del indicador de carga de cada día (tarea 7.4 de `schedule-assign`) y de las clases de
// fin de semana y de hoy (tarea 9.6).
//
// Cubren el escenario "Indicador de carga al arrastrar" de `specs/employee-assignment/spec.md`
// y la decisión 5 de `design.md`: mientras se arrastra un empleado, cada día indica cuántas
// programaciones tiene ese día, y no indica nada si no tiene ninguna.
//
// Se monta el tablero de la semana del 1 al 7 de noviembre de la semilla con el panel de
// empleados, dentro del `DragDropProvider` real, y el arrastre se maneja con las acciones del
// gestor (ver `src/test/dnd.ts`). La semilla programa:
// - lunes 2: "J-1024 Pintar oficina" (id 1) con Ana López (3) y Luis Martínez (5), y otra (id 2) con Ana;
// - martes 3: "J-1019 Cambiar ventanas" (id 3) con Carlos Ruiz (8);
// - jueves 5: "J-1029 Instalar lámparas" (id 4), sin empleados.
import { DragDropProvider } from '@dnd-kit/react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Absence, Employee } from '../../api/types'
import { EmployeePanel } from '../../employees/EmployeePanel'
import { absencesByDay, schedulesByDay } from '../../lib/selectors'
import { createSeed } from '../../mocks/seed'
import { CapturadorDelGestor, empezarArrastre, gestorActual, simularApisDeArrastre } from '../../test/dnd'
import { programacionesConTrabajo } from '../../test/semilla'
import { WeekBoard } from '../WeekBoard'
import { DayColumn } from './DayColumn'

simularApisDeArrastre()

const DIAS = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']
const NOMBRES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const INDICADOR = /^\d+ jobs?$/

const semilla = createSeed(new Date(2026, 10, 3))
const PROGRAMACIONES = programacionesConTrabajo(semilla)
const EMPLEADOS = new Map<number, Employee>(semilla.employees.map((empleado) => [empleado.employeesId, empleado]))

function renderTablero(ausencias: Absence[] = []) {
  render(
    <DragDropProvider>
      <CapturadorDelGestor />
      <WeekBoard
        days={DIAS}
        today="2026-11-03"
        schedulesByDay={schedulesByDay(PROGRAMACIONES, DIAS)}
        absencesByDay={absencesByDay(ausencias, DIAS)}
        employeesById={EMPLEADOS}
      />
      <EmployeePanel
        employees={semilla.employees}
        error={null}
        schedules={PROGRAMACIONES}
        absences={ausencias}
        days={DIAS}
        today="2026-11-03"
        hours={undefined}
      />
    </DragDropProvider>,
  )
}

/** Columna del día con nombre abreviado `nombre` ("Mon"): su encabezado y sus tarjetas. */
function columnaDelDia(nombre: string): HTMLElement {
  const encabezado = screen.getByText(nombre).parentElement as HTMLElement
  return encabezado.parentElement as HTMLElement
}

/** Texto del indicador de carga del día, o null si no muestra ninguno. */
const indicador = (nombre: string) => within(columnaDelDia(nombre)).queryByText(INDICADOR)?.textContent ?? null

/** Indicadores de los siete días, de domingo a sábado. */
const indicadores = () => Object.fromEntries(NOMBRES.map((nombre) => [nombre, indicador(nombre)]))

describe('DayColumn: indicador de carga al arrastrar un empleado', () => {
  it('sin ningún arrastre en curso ningún día muestra indicador', () => {
    renderTablero()

    expect(screen.queryAllByText(INDICADOR)).toHaveLength(0)
  })

  it('escenario "Indicador de carga al arrastrar": arrastrando a Ana el lunes indica "2 jobs" y el martes nada', async () => {
    renderTablero()

    await empezarArrastre('employee-3')

    await waitFor(() => expect(indicador('Mon')).toBe('2 jobs'))
    expect(indicador('Tue')).toBeNull()
    expect(indicadores()).toEqual({
      Sun: null,
      Mon: '2 jobs',
      Tue: null,
      Wed: null,
      Thu: null,
      Fri: null,
      Sat: null,
    })
  })

  it('con una sola programación ese día usa el singular: arrastrando a Carlos el martes indica "1 job"', async () => {
    renderTablero()

    await empezarArrastre('employee-8')

    await waitFor(() => expect(indicador('Tue')).toBe('1 job'))
    expect(indicador('Mon')).toBeNull()
  })

  it('arrastrando a un empleado sin programaciones en la semana ningún día muestra indicador', async () => {
    renderTablero()

    // Marta Gómez (1) no está en ninguna programación de la semana.
    await empezarArrastre('employee-1')

    expect(gestorActual().dragOperation.status.dragging).toBe(true)
    expect(screen.queryAllByText(INDICADOR)).toHaveLength(0)
  })

  it('arrastrando a Luis desde su tarjeta del lunes el lunes indica "1 job"', async () => {
    renderTablero()

    await empezarArrastre('employee-5-in-1')

    await waitFor(() => expect(indicador('Mon')).toBe('1 job'))
    expect(screen.getAllByText(INDICADOR)).toHaveLength(1)
  })

  it('arrastrando una tarjeta de programación ningún día muestra indicador', async () => {
    renderTablero()

    await empezarArrastre('schedule-1')

    expect(screen.queryAllByText(INDICADOR)).toHaveLength(0)
  })

  it('al terminar el arrastre el indicador desaparece', async () => {
    renderTablero()
    await empezarArrastre('employee-3')
    await waitFor(() => expect(indicador('Mon')).toBe('2 jobs'))

    await act(async () => {
      gestorActual().actions.stop({ canceled: true })
    })

    await waitFor(() => expect(screen.queryAllByText(INDICADOR)).toHaveLength(0))
  })
})

// Tareas 4.3 y 4.4 de `employee-absences`: la zona "Absences" al pie de cada día se resalta al
// arrastrar un empleado, y las tarjetas de un día en que ese empleado está ausente no se resaltan.
describe('DayColumn: ausencias', () => {
  const ANA_AUSENTE_EL_LUNES: Absence = {
    employeeAbsencesId: 1,
    employeesId: 3,
    date: '2026-11-02',
    absenceType: 'Vacation',
    absenceComment: null,
  }

  /** Zona "Absences" del día `nombre`. */
  const zona = (nombre: string) => within(columnaDelDia(nombre)).getByText('Absences').parentElement as HTMLElement
  const tarjetas = (nombre: string) => within(columnaDelDia(nombre)).getAllByRole('article')

  it('sin ningún arrastre ninguna zona de ausencias está resaltada', () => {
    renderTablero()

    for (const nombre of NOMBRES) expect(zona(nombre)).not.toHaveClass(/accepting/)
  })

  it.each([
    ['un empleado del panel', 'employee-3'],
    ['un empleado de una tarjeta', 'employee-5-in-1'],
  ])('arrastrando %s las siete zonas se resaltan como destinos válidos', async (_origen, id) => {
    renderTablero()

    await empezarArrastre(id)

    await waitFor(() => expect(zona('Mon')).toHaveClass(/accepting/))
    for (const nombre of NOMBRES) expect(zona(nombre)).toHaveClass(/accepting/)
  })

  it('arrastrando una tarjeta o una ausencia las zonas no se resaltan', async () => {
    renderTablero([ANA_AUSENTE_EL_LUNES])

    await empezarArrastre('schedule-1')
    expect(zona('Mon')).not.toHaveClass(/accepting/)
    await act(async () => {
      gestorActual().actions.stop({ canceled: true })
    })
    await empezarArrastre('absence-1')

    expect(zona('Mon')).not.toHaveClass(/accepting/)
  })

  it('escenario "Arrastrar a una ausente a una tarjeta de su día": las tarjetas del lunes no se resaltan, las de otros días sí', async () => {
    renderTablero([ANA_AUSENTE_EL_LUNES])

    await empezarArrastre('employee-3')

    await waitFor(() => expect(tarjetas('Tue')[0]).toHaveClass(/accepting/))
    expect(tarjetas('Thu')[0]).toHaveClass(/accepting/)
    for (const tarjeta of tarjetas('Mon')) expect(tarjeta).not.toHaveClass(/accepting/)
  })

  it('arrastrando a otro empleado que no está ausente las tarjetas del lunes sí se resaltan', async () => {
    renderTablero([ANA_AUSENTE_EL_LUNES])

    await empezarArrastre('employee-8')

    await waitFor(() => expect(tarjetas('Tue')[0]).toHaveClass(/accepting/))
    for (const tarjeta of tarjetas('Mon')) expect(tarjeta).toHaveClass(/accepting/)
  })

  it('un empleado ausente el lunes arrastrado desde su tarjeta del martes no resalta las tarjetas del lunes', async () => {
    renderTablero([{ ...ANA_AUSENTE_EL_LUNES, employeesId: 8 }])

    await empezarArrastre('employee-8-in-3')

    await waitFor(() => expect(tarjetas('Thu')[0]).toHaveClass(/accepting/))
    for (const tarjeta of tarjetas('Mon')) expect(tarjeta).not.toHaveClass(/accepting/)
    expect(tarjetas('Tue')[0]).toHaveClass(/accepting/)
  })

  // Tarea 6.2: requisito "Indicador de ausencia al arrastrar".
  describe('indicador "Absent" al arrastrar', () => {
    const AUSENTE_EL_MIERCOLES = (employeesId: number): Absence => ({
      employeeAbsencesId: 9,
      employeesId,
      date: '2026-11-04',
      absenceType: 'Sick',
      absenceComment: null,
    })
    const ausente = (nombre: string) => within(columnaDelDia(nombre)).queryByText('Absent')

    it('escenario "Arrastrar a Ana, ausente el miércoles": el lunes indica su carga y el miércoles "Absent"', async () => {
      renderTablero([AUSENTE_EL_MIERCOLES(3)])

      await empezarArrastre('employee-3')

      await waitFor(() => expect(indicador('Mon')).toBe('2 jobs'))
      expect(ausente('Wed')).toBeInTheDocument()
      expect(indicador('Wed')).toBeNull()
    })

    it('con una sola programación el lunes indica "1 job" y el miércoles "Absent" (arrastrando a Luis desde su tarjeta)', async () => {
      renderTablero([AUSENTE_EL_MIERCOLES(5)])

      await empezarArrastre('employee-5-in-1')

      await waitFor(() => expect(indicador('Mon')).toBe('1 job'))
      expect(ausente('Wed')).toBeInTheDocument()
    })

    it('"Absent" solo aparece en los días de la ausencia, no en los demás', async () => {
      renderTablero([AUSENTE_EL_MIERCOLES(3)])

      await empezarArrastre('employee-3')

      await waitFor(() => expect(screen.getAllByText('Absent')).toHaveLength(1))
      for (const nombre of ['Sun', 'Mon', 'Tue', 'Thu', 'Fri', 'Sat']) expect(ausente(nombre)).not.toBeInTheDocument()
    })

    it('arrastrando a otro empleado que no está ausente el miércoles no indica "Absent"', async () => {
      renderTablero([AUSENTE_EL_MIERCOLES(3)])

      await empezarArrastre('employee-8')

      await waitFor(() => expect(indicador('Tue')).toBe('1 job'))
      expect(screen.queryByText('Absent')).not.toBeInTheDocument()
    })

    it('sin ningún arrastre en curso no se muestra "Absent"', () => {
      renderTablero([AUSENTE_EL_MIERCOLES(3)])

      expect(screen.queryByText('Absent')).not.toBeInTheDocument()
    })

    it('al terminar el arrastre "Absent" desaparece', async () => {
      renderTablero([AUSENTE_EL_MIERCOLES(3)])
      await empezarArrastre('employee-3')
      await waitFor(() => expect(ausente('Wed')).toBeInTheDocument())

      await act(async () => {
        gestorActual().actions.stop({ canceled: true })
      })

      await waitFor(() => expect(screen.queryByText('Absent')).not.toBeInTheDocument())
    })
  })

  describe('chip de ausencia', () => {
    const renderZona = (employeeAbsencesId: number) =>
      render(
        <DragDropProvider>
          <DayColumn
            date="2026-11-02"
            isToday={false}
            schedules={[]}
            absences={[{ ...ANA_AUSENTE_EL_LUNES, employeeAbsencesId }]}
            employeesById={EMPLEADOS}
          />
        </DragDropProvider>,
      )

    it('con id real se puede arrastrar', async () => {
      renderZona(1)

      const chip = screen.getByText('Ana López').parentElement as HTMLElement
      await waitFor(() => expect(chip).toHaveAttribute('aria-disabled', 'false'))
    })

    it('con id temporal negativo (antes de que el servidor confirme) no se puede arrastrar', async () => {
      renderZona(-1)

      const chip = screen.getByText('Ana López').parentElement as HTMLElement
      await waitFor(() => expect(chip).toHaveAttribute('aria-disabled', 'true'))
    })
  })
})

// Tarea 9.6: los sábados y domingos llevan la clase `weekend` del CSS Module y el día de hoy, la
// clase `today`. Del 1 al 7 de noviembre de 2026: el 1 es domingo y el 7, sábado.
describe('DayColumn: fin de semana y hoy', () => {
  /** Monta las siete columnas de la semana con `hoy` como día actual. */
  function renderColumnas(hoy: string) {
    render(
      <DragDropProvider>
        {DIAS.map((dia) => (
          <DayColumn key={dia} date={dia} isToday={dia === hoy} schedules={[]} absences={[]} employeesById={EMPLEADOS} />
        ))}
      </DragDropProvider>,
    )
  }

  /** Nombres de los días cuya columna tiene una clase que casa con `clase`. */
  const diasConClase = (clase: RegExp) => NOMBRES.filter((nombre) => clase.test(columnaDelDia(nombre).className))

  it('solo el domingo y el sábado tienen la clase de fin de semana', () => {
    renderColumnas('2026-11-03')

    expect(diasConClase(/weekend/)).toEqual(['Sun', 'Sat'])
    expect(columnaDelDia('Sun')).toHaveClass(/weekend/)
    expect(columnaDelDia('Sat')).toHaveClass(/weekend/)
    for (const laborable of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
      expect(columnaDelDia(laborable)).not.toHaveClass(/weekend/)
    }
  })

  it('solo el día de hoy, el martes, tiene la clase de hoy', () => {
    renderColumnas('2026-11-03')

    expect(diasConClase(/today/)).toEqual(['Tue'])
  })

  it('sin hoy en la semana ninguna columna tiene la clase de hoy', () => {
    renderColumnas('2026-11-10')

    expect(diasConClase(/today/)).toEqual([])
    expect(diasConClase(/weekend/)).toEqual(['Sun', 'Sat'])
  })

  it('si hoy es sábado esa columna tiene las dos clases', () => {
    renderColumnas('2026-11-07')

    expect(columnaDelDia('Sat')).toHaveClass(/weekend/)
    expect(columnaDelDia('Sat')).toHaveClass(/today/)
    expect(diasConClase(/today/)).toEqual(['Sat'])
  })

  it('un lunes de otra semana no es fin de semana y un domingo sí', () => {
    render(
      <DragDropProvider>
        <DayColumn date="2026-12-28" isToday={false} schedules={[]} absences={[]} employeesById={EMPLEADOS} />
        <DayColumn date="2027-01-03" isToday={false} schedules={[]} absences={[]} employeesById={EMPLEADOS} />
      </DragDropProvider>,
    )

    expect(columnaDelDia('Mon')).not.toHaveClass(/weekend/)
    expect(columnaDelDia('Sun')).toHaveClass(/weekend/)
  })
})
