// Tests del tablero de la semana (tarea 5.2 de `schedule-assign`): siete columnas de
// días, cada una con las tarjetas de sus programaciones.
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Absence, Employee, IsoDate, Schedule } from '../../api/types'
import { absencesByDay } from '../../lib/selectors'
import { createSeed } from '../../mocks/seed'
import { WeekBoard } from './WeekBoard'

const DIAS: IsoDate[] = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']

const semilla = createSeed(new Date(2026, 10, 3))
const EMPLEADOS = new Map<number, Employee>(semilla.employees.map((empleado) => [empleado.employeesId, empleado]))

const pintar = semilla.jobs[6]
const lamparas = semilla.jobs[11]

function porDia(programaciones: Schedule[]): Record<IsoDate, Schedule[]> {
  return Object.fromEntries(DIAS.map((dia) => [dia, programaciones.filter((item) => item.date === dia)]))
}

/** Columna del día con nombre abreviado `nombre` ("Mon"). */
function columnaDelDia(nombre: string): HTMLElement {
  const encabezado = screen.getByText(nombre).parentElement as HTMLElement
  return encabezado.parentElement as HTMLElement
}

const tarjetasDelDia = (nombre: string) => within(columnaDelDia(nombre)).queryAllByRole('article')

const SIN_AUSENCIAS = absencesByDay([], DIAS)

/** Zona "Absences" de la columna del día `nombre`. */
const zonaDelDia = (nombre: string) => within(columnaDelDia(nombre)).getByText('Absences').parentElement as HTMLElement

describe('WeekBoard', () => {
  it('muestra los siete días y resalta solo el día de hoy', () => {
    render(
      <WeekBoard
        days={DIAS}
        today="2026-11-03"
        schedulesByDay={porDia([])}
        absencesByDay={SIN_AUSENCIAS}
        employeesById={EMPLEADOS}
      />,
    )

    for (const nombre of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      expect(screen.getByText(nombre)).toBeInTheDocument()
    }
    const resaltados = document.querySelectorAll('[aria-current="date"]')
    expect(resaltados).toHaveLength(1)
    expect(resaltados[0]).toHaveTextContent('Tue')
  })

  it('pone cada tarjeta bajo su día y deja vacíos los días sin programaciones', () => {
    const programaciones: Schedule[] = [
      { jobSchedulesId: 1, job: pintar, date: '2026-11-02', startTime: '07:00', employeesIds: [3], scheduleComment: null },
      { jobSchedulesId: 2, job: lamparas, date: '2026-11-05', startTime: '09:30', employeesIds: [], scheduleComment: null },
    ]

    render(
      <WeekBoard
        days={DIAS}
        today="2026-11-03"
        schedulesByDay={porDia(programaciones)}
        absencesByDay={SIN_AUSENCIAS}
        employeesById={EMPLEADOS}
      />,
    )

    expect(tarjetasDelDia('Mon')).toHaveLength(1)
    expect(tarjetasDelDia('Mon')[0]).toHaveTextContent('J-1024')
    expect(tarjetasDelDia('Thu')).toHaveLength(1)
    expect(tarjetasDelDia('Thu')[0]).toHaveTextContent('J-1029')
    for (const nombre of ['Sun', 'Tue', 'Wed', 'Fri', 'Sat']) {
      expect(tarjetasDelDia(nombre)).toHaveLength(0)
    }
  })

  it('muestra las tarjetas de un día en el orden en que las recibe', () => {
    const programaciones: Schedule[] = [
      { jobSchedulesId: 1, job: pintar, date: '2026-11-02', startTime: '07:00', employeesIds: [], scheduleComment: null },
      { jobSchedulesId: 2, job: pintar, date: '2026-11-02', startTime: '08:00', employeesIds: [], scheduleComment: null },
      { jobSchedulesId: 3, job: lamparas, date: '2026-11-02', startTime: '09:00', employeesIds: [], scheduleComment: null },
    ]

    render(
      <WeekBoard
        days={DIAS}
        today="2026-11-03"
        schedulesByDay={porDia(programaciones)}
        absencesByDay={SIN_AUSENCIAS}
        employeesById={EMPLEADOS}
      />,
    )

    const horas = tarjetasDelDia('Mon').map((tarjeta) => tarjeta.textContent?.match(/\d{2}:\d{2}/)?.[0])
    expect(horas).toEqual(['07:00', '08:00', '09:00'])
  })
})

// Requisito "Zona de ausencias por día" de `specs/employee-absences/spec.md`.
describe('WeekBoard: zonas de ausencias', () => {
  const ANA_VACACIONES: Absence = {
    employeeAbsencesId: 1,
    employeesId: 3,
    date: '2026-11-02',
    absenceType: 'Vacation',
    absenceComment: 'Viaje familiar',
  }

  const renderConAusencias = (ausencias: Absence[]) =>
    render(
      <WeekBoard
        days={DIAS}
        today="2026-11-03"
        schedulesByDay={porDia([])}
        absencesByDay={absencesByDay(ausencias, DIAS)}
        employeesById={EMPLEADOS}
      />,
    )

  it('escenario "Ana de vacaciones el lunes": la zona del lunes la muestra con "Vacation" y las demás no', () => {
    renderConAusencias([ANA_VACACIONES])

    const lunes = zonaDelDia('Mon')
    expect(within(lunes).getByText('Ana López')).toBeInTheDocument()
    expect(within(lunes).getByText('Vacation')).toBeInTheDocument()
    expect(within(lunes).queryByText('No absences')).not.toBeInTheDocument()
    for (const nombre of ['Sun', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      expect(within(zonaDelDia(nombre)).queryByText('Ana López')).not.toBeInTheDocument()
      expect(within(zonaDelDia(nombre)).getByText('No absences')).toBeInTheDocument()
    }
  })

  it('el comentario de la ausencia se ve al pasar el puntero (title del chip)', () => {
    renderConAusencias([ANA_VACACIONES])

    expect(within(zonaDelDia('Mon')).getByText('Ana López').parentElement).toHaveAttribute('title', 'Viaje familiar')
  })

  it('una ausencia sin comentario no tiene title', () => {
    renderConAusencias([{ ...ANA_VACACIONES, absenceComment: null }])

    expect(within(zonaDelDia('Mon')).getByText('Ana López').parentElement).not.toHaveAttribute('title')
  })

  it('escenario "Cambio de semana": sin ausencias las siete zonas se muestran vacías', () => {
    renderConAusencias([])

    expect(screen.getAllByText('Absences')).toHaveLength(7)
    expect(screen.getAllByText('No absences')).toHaveLength(7)
  })

  it('varias ausencias del mismo día aparecen en la misma zona', () => {
    renderConAusencias([ANA_VACACIONES, { ...ANA_VACACIONES, employeeAbsencesId: 2, employeesId: 8, absenceType: 'Sick' }])

    const lunes = zonaDelDia('Mon')
    expect(within(lunes).getByText('Ana López')).toBeInTheDocument()
    expect(within(lunes).getByText('Carlos Ruiz')).toBeInTheDocument()
    expect(within(lunes).getByText('Sick')).toBeInTheDocument()
  })
})
