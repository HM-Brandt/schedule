// Tests del panel de empleados (tareas 7.1 y 9.6 de `schedule-assign`).
//
// Cubren "Panel de empleados activos" de `specs/employee-assignment/spec.md`: solo aparecen
// los empleados con `status` `activo`, cada uno con sus iniciales, su nombre completo y su
// cargo, y el aviso cuando no se pudieron cargar.
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Employee } from '../../api/types'
import { employeeHue } from '../../lib/colors'
import { createSeed } from '../../mocks/seed'
import { simularApisDeArrastre } from '../../test/dnd'
import { EmployeePanel } from './EmployeePanel'

simularApisDeArrastre()

const ANA: Employee = { id: 3, first_name: 'Ana', last_name: 'López', title: 'Pintora', status: 'activo' }
const PEDRO_INACTIVO: Employee = { id: 4, first_name: 'Pedro', last_name: 'Sánchez', title: 'Albañil', status: 'inactivo' }

function renderPanel(employees: Employee[], error: Error | null = null) {
  render(<EmployeePanel employees={employees} error={error} />)
  return screen.getByRole('list')
}

/** Fila del panel que contiene el texto `nombre`. */
const fila = (lista: HTMLElement, nombre: string) => within(lista).getByText(nombre).closest('li') as HTMLElement

describe('EmployeePanel', () => {
  it('muestra el título "Employees"', () => {
    renderPanel([ANA])

    expect(screen.getByRole('heading', { level: 2, name: 'Employees' })).toBeInTheDocument()
  })

  it('escenario "Empleado inactivo": con Ana (activo) y Pedro (inactivo) muestra a Ana y no a Pedro', () => {
    const lista = renderPanel([ANA, PEDRO_INACTIVO])

    expect(within(lista).getAllByRole('listitem')).toHaveLength(1)
    expect(within(lista).getByText('Ana López')).toBeInTheDocument()
    expect(screen.queryByText('Pedro Sánchez')).not.toBeInTheDocument()
    expect(screen.queryByText('PS')).not.toBeInTheDocument()
  })

  it('con la semilla muestra los 8 activos y ninguno de los 2 inactivos', () => {
    const { employees } = createSeed(new Date(2026, 10, 3))
    const lista = renderPanel(employees)

    expect(within(lista).getAllByRole('listitem')).toHaveLength(8)
    for (const nombre of [
      'Marta Gómez',
      'Jorge Pérez',
      'Ana López',
      'Pedro Sánchez',
      'Luis Martínez',
      'Elena Díaz',
      'Sofía Romero',
      'Carlos Ruiz',
    ]) {
      expect(within(lista).getByText(nombre)).toBeInTheDocument()
    }
    expect(screen.queryByText('Raúl Torres')).not.toBeInTheDocument()
    expect(screen.queryByText('Lucía Navarro')).not.toBeInTheDocument()
  })

  it('cada fila muestra las iniciales, el nombre completo y el cargo: "AL", "Ana López", "Pintora"', () => {
    const lista = renderPanel([ANA])

    const ana = fila(lista, 'Ana López')
    expect(within(ana).getByText('AL')).toBeInTheDocument()
    expect(within(ana).getByText('Ana López')).toBeInTheDocument()
    expect(within(ana).getByText('Pintora')).toBeInTheDocument()
  })

  it('las iniciales salen en mayúsculas aunque el nombre llegue en minúsculas', () => {
    const lista = renderPanel([{ ...ANA, first_name: 'ana', last_name: 'lópez' }])

    expect(within(fila(lista, 'ana lópez')).getByText('AL')).toBeInTheDocument()
  })

  it('si todos son inactivos la lista queda vacía', () => {
    const lista = renderPanel([PEDRO_INACTIVO])

    expect(within(lista).queryAllByRole('listitem')).toHaveLength(0)
  })

  // Tarea 9.6: el avatar de cada empleado lleva su tono, el mismo que su chip en las tarjetas.
  it('el avatar con las iniciales lleva el tono del empleado', () => {
    const lista = renderPanel([ANA, { ...ANA, id: 6, first_name: 'Elena', last_name: 'Díaz' }])

    expect(within(fila(lista, 'Ana López')).getByText('AL')).toHaveAttribute('data-hue', String(employeeHue(3)))
    expect(within(fila(lista, 'Elena Díaz')).getByText('ED')).toHaveAttribute('data-hue', String(employeeHue(6)))
  })

  it('con la semilla los 8 activos llevan 8 tonos distintos', () => {
    const { employees } = createSeed(new Date(2026, 10, 3))
    const lista = renderPanel(employees)

    const tonos = within(lista)
      .getAllByRole('listitem')
      .map((elemento) => elemento.querySelector('[data-hue]')?.getAttribute('data-hue'))
    expect(new Set(tonos).size).toBe(8)
  })

  it('sin error no muestra ningún aviso', () => {
    renderPanel([ANA])

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('con error muestra "Couldn\'t load employees." seguido del mensaje', () => {
    renderPanel([], new Error('Fallo simulado del servidor'))

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load employees. Fallo simulado del servidor")
    expect(screen.getByRole('heading', { level: 2, name: 'Employees' })).toBeInTheDocument()
  })
})
