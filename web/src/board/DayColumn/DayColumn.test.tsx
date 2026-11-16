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
import type { Employee } from '../../api/types'
import { EmployeePanel } from '../../employees/EmployeePanel'
import { schedulesByDay } from '../../lib/selectors'
import { createSeed } from '../../mocks/seed'
import { CapturadorDelGestor, empezarArrastre, gestorActual, simularApisDeArrastre } from '../../test/dnd'
import { WeekBoard } from '../WeekBoard'
import { DayColumn } from './DayColumn'

simularApisDeArrastre()

const DIAS = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']
const NOMBRES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const INDICADOR = /^\d+ jobs?$/

const semilla = createSeed(new Date(2026, 10, 3))
const EMPLEADOS = new Map<number, Employee>(semilla.employees.map((empleado) => [empleado.employeesId, empleado]))

function renderTablero() {
  render(
    <DragDropProvider>
      <CapturadorDelGestor />
      <WeekBoard
        days={DIAS}
        today="2026-11-03"
        schedulesByDay={schedulesByDay(semilla.schedules, DIAS)}
        employeesById={EMPLEADOS}
      />
      <EmployeePanel
        employees={semilla.employees}
        error={null}
        schedules={semilla.schedules}
        days={DIAS}
        today="2026-11-03"
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

// Tarea 9.6: los sábados y domingos llevan la clase `weekend` del CSS Module y el día de hoy, la
// clase `today`. Del 1 al 7 de noviembre de 2026: el 1 es domingo y el 7, sábado.
describe('DayColumn: fin de semana y hoy', () => {
  /** Monta las siete columnas de la semana con `hoy` como día actual. */
  function renderColumnas(hoy: string) {
    render(
      <DragDropProvider>
        {DIAS.map((dia) => (
          <DayColumn key={dia} date={dia} isToday={dia === hoy} schedules={[]} employeesById={EMPLEADOS} />
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
        <DayColumn date="2026-12-28" isToday={false} schedules={[]} employeesById={EMPLEADOS} />
        <DayColumn date="2027-01-03" isToday={false} schedules={[]} employeesById={EMPLEADOS} />
      </DragDropProvider>,
    )

    expect(columnaDelDia('Mon')).not.toHaveClass(/weekend/)
    expect(columnaDelDia('Sun')).toHaveClass(/weekend/)
  })
})
