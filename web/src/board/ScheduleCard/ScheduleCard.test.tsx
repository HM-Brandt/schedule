// Tests de la tarjeta de una programación (tareas 5.2 y 6.3 de `schedule-assign`).
//
// Cubren "Solo hora de inicio" (escenario "Tarjeta con hora de inicio") de
// `specs/weekly-schedule-board/spec.md`, "Empleados en la tarjeta" de
// `specs/employee-assignment/spec.md` y que la tarjeta se puede arrastrar salvo mientras
// tiene un id temporal (negativo), antes de que el servidor confirme su creación.
import { DragDropProvider } from '@dnd-kit/react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Employee, Schedule } from '../../api/types'
import { createSeed } from '../../mocks/seed'
import { simularApisDeArrastre } from '../../test/dnd'
import { ScheduleCard } from './ScheduleCard'

simularApisDeArrastre()

const semilla = createSeed(new Date(2026, 10, 3))

/** Todos los empleados de la semilla por id: Ana López es el 3 y Luis Martínez el 5. */
const EMPLEADOS = new Map<number, Employee>(semilla.employees.map((empleado) => [empleado.id, empleado]))

function programacion(cambios: Partial<Schedule> = {}): Schedule {
  return {
    id: 1,
    job: { id: 7, number: 'J-1024', name: 'Pintar oficina' },
    date: '2026-11-02',
    start_time: '07:00',
    employee_ids: [3, 5],
    ...cambios,
  }
}

function renderTarjeta(schedule: Schedule, employeesById = EMPLEADOS) {
  render(<ScheduleCard schedule={schedule} employeesById={employeesById} />)
  return screen.getByRole('article')
}

describe('ScheduleCard', () => {
  it('muestra el número, el nombre del trabajo y la hora de inicio "07:00"', () => {
    const tarjeta = renderTarjeta(programacion())

    expect(tarjeta).toHaveTextContent('J-1024')
    expect(tarjeta).toHaveTextContent('Pintar oficina')
    expect(screen.getByText('07:00')).toBeInTheDocument()
  })

  it('no muestra ninguna hora de fin: una sola hora y ningún rango "HH:mm - HH:mm"', () => {
    const tarjeta = renderTarjeta(programacion())
    const texto = tarjeta.textContent ?? ''

    expect(texto.match(/\d{2}:\d{2}/g)).toEqual(['07:00'])
    expect(texto).not.toMatch(/\d{2}:\d{2}\s*[-–]\s*\d{2}:\d{2}/)
  })

  it('muestra otras horas tal como llegan, en 24 horas: "23:00"', () => {
    const tarjeta = renderTarjeta(programacion({ start_time: '23:00' }))

    expect((tarjeta.textContent ?? '').match(/\d{2}:\d{2}/g)).toEqual(['23:00'])
  })

  it('muestra las iniciales de cada empleado con su nombre completo al pasar el puntero', () => {
    renderTarjeta(programacion())

    expect(screen.getByTitle('Ana López')).toHaveTextContent('AL')
    expect(screen.getByTitle('Luis Martínez')).toHaveTextContent('LM')
  })

  it('muestra los empleados en el orden de la programación', () => {
    const tarjeta = renderTarjeta(programacion({ employee_ids: [5, 3] }))

    const iniciales = Array.from(tarjeta.querySelectorAll('[title]')).map((elemento) => elemento.textContent)
    expect(iniciales).toEqual(['LM', 'AL'])
  })

  it('con empleados no muestra "No employees"', () => {
    renderTarjeta(programacion())

    expect(screen.queryByText('No employees')).not.toBeInTheDocument()
  })

  it('sin empleados indica "No employees" y no muestra iniciales', () => {
    const tarjeta = renderTarjeta(programacion({ employee_ids: [] }))

    expect(screen.getByText('No employees')).toBeInTheDocument()
    expect(tarjeta.querySelectorAll('[title]')).toHaveLength(0)
  })

  it('omite los ids de empleado que no están en el mapa', () => {
    const tarjeta = renderTarjeta(programacion({ employee_ids: [3, 99] }))

    expect(screen.getByTitle('Ana López')).toHaveTextContent('AL')
    expect(tarjeta.querySelectorAll('[title]')).toHaveLength(1)
    expect(screen.queryByText('No employees')).not.toBeInTheDocument()
  })

  it('con empleados asignados pero aún sin cargar no muestra "No employees" ni iniciales', () => {
    const tarjeta = renderTarjeta(programacion({ employee_ids: [3, 5] }), new Map())

    expect(screen.queryByText('No employees')).not.toBeInTheDocument()
    expect(tarjeta.querySelectorAll('[title]')).toHaveLength(0)
  })

  describe('arrastre', () => {
    /** Monta la tarjeta dentro de un proveedor de arrastre y devuelve el aviso de inicio de arrastre. */
    function renderArrastrable(schedule: Schedule) {
      const alEmpezar = vi.fn()
      render(
        <DragDropProvider onDragStart={alEmpezar}>
          <ScheduleCard schedule={schedule} employeesById={EMPLEADOS} />
        </DragDropProvider>,
      )
      return { tarjeta: screen.getByRole('article'), alEmpezar }
    }

    /** Intenta empezar el arrastre con el teclado: foco en la tarjeta y barra espaciadora. */
    function pulsarEspacio(tarjeta: HTMLElement) {
      tarjeta.focus()
      fireEvent.keyDown(tarjeta, { key: ' ', code: 'Space' })
    }

    it('con un id del servidor se puede arrastrar', async () => {
      const { tarjeta, alEmpezar } = renderArrastrable(programacion({ id: 1 }))

      await waitFor(() => expect(tarjeta).toHaveAttribute('aria-disabled', 'false'))
      pulsarEspacio(tarjeta)

      await waitFor(() => expect(alEmpezar).toHaveBeenCalledTimes(1))
    })

    it('con un id temporal negativo no se puede arrastrar', async () => {
      const { tarjeta, alEmpezar } = renderArrastrable(programacion({ id: -1 }))

      await waitFor(() => expect(tarjeta).toHaveAttribute('aria-disabled', 'true'))
      pulsarEspacio(tarjeta)

      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(alEmpezar).not.toHaveBeenCalled()
    })
  })
})
