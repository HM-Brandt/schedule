// Tests del tablero de la semana (tarea 5.2 de `schedule-assign`): siete columnas de
// días, cada una con las tarjetas de sus programaciones.
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Employee, IsoDate, Schedule } from '../../api/types'
import { createSeed } from '../../mocks/seed'
import { WeekBoard } from './WeekBoard'

const DIAS: IsoDate[] = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']

const semilla = createSeed(new Date(2026, 10, 3))
const EMPLEADOS = new Map<number, Employee>(semilla.employees.map((empleado) => [empleado.id, empleado]))

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

describe('WeekBoard', () => {
  it('muestra los siete días y resalta solo el día de hoy', () => {
    render(<WeekBoard days={DIAS} today="2026-11-03" schedulesByDay={porDia([])} employeesById={EMPLEADOS} />)

    for (const nombre of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      expect(screen.getByText(nombre)).toBeInTheDocument()
    }
    const resaltados = document.querySelectorAll('[aria-current="date"]')
    expect(resaltados).toHaveLength(1)
    expect(resaltados[0]).toHaveTextContent('Tue')
  })

  it('pone cada tarjeta bajo su día y deja vacíos los días sin programaciones', () => {
    const programaciones: Schedule[] = [
      { id: 1, job: pintar, date: '2026-11-02', start_time: '07:00', employee_ids: [3] },
      { id: 2, job: lamparas, date: '2026-11-05', start_time: '09:30', employee_ids: [] },
    ]

    render(
      <WeekBoard days={DIAS} today="2026-11-03" schedulesByDay={porDia(programaciones)} employeesById={EMPLEADOS} />,
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
      { id: 1, job: pintar, date: '2026-11-02', start_time: '07:00', employee_ids: [] },
      { id: 2, job: pintar, date: '2026-11-02', start_time: '08:00', employee_ids: [] },
      { id: 3, job: lamparas, date: '2026-11-02', start_time: '09:00', employee_ids: [] },
    ]

    render(
      <WeekBoard days={DIAS} today="2026-11-03" schedulesByDay={porDia(programaciones)} employeesById={EMPLEADOS} />,
    )

    const horas = tarjetasDelDia('Mon').map((tarjeta) => tarjeta.textContent?.match(/\d{2}:\d{2}/)?.[0])
    expect(horas).toEqual(['07:00', '08:00', '09:00'])
  })
})
