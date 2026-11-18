// Tests de la tarjeta de un empleado del panel "Employees".
//
// Cubren la disposición acordada para que los recuadros de días con trabajo se adapten al ancho
// de la fila (`design.md` de `schedule-assign`: "Los recuadros de días con trabajo de cada
// empleado se adaptan al ancho de su fila para no salirse del panel ni de los cajones"): primero
// el círculo de iniciales y el nombre; debajo, a todo el ancho, el cargo y los siete recuadros,
// que usan la variante `fill` de `WeekLoad`.
//
// jsdom no calcula la disposición: aquí se comprueban el orden y las clases, y las medidas reales
// están en el e2e `recuadros-a-todo-el-ancho.spec.ts`.
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Employee, IsoDate } from '../../api/types'
import { employeeHue } from '../../lib/colors'
import { simularApisDeArrastre } from '../../test/dnd'
import { empleado } from '../../test/fabricas'
import weekStyles from '../WeekLoad/WeekLoad.module.css'
import { EmployeeItem } from './EmployeeItem'
import styles from './EmployeeItem.module.css'

simularApisDeArrastre()

const DIAS = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']
const LUNES = DIAS[1]
const HOY = DIAS[2]

const ANA: Employee = empleado(3, 'Ana', 'López', 'Labor')

function renderEmpleado(load: Map<IsoDate, number> | undefined = undefined, employee: Employee = ANA) {
  render(
    <ul>
      <EmployeeItem employee={employee} days={DIAS} today={HOY} load={load} />
    </ul>,
  )
  const tarjeta = screen.getByRole('listitem')
  return {
    tarjeta,
    iniciales: within(tarjeta).getByText('AL'),
    nombre: within(tarjeta).getByText('Ana López'),
    cargo: within(tarjeta).getByText(employee.title),
    recuadros: within(tarjeta).getByRole('img'),
  }
}

/** `true` si `a` aparece antes que `b` en el documento. */
const antesQue = (a: HTMLElement, b: HTMLElement) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('EmployeeItem', () => {
  it('muestra el círculo de iniciales con el tono del empleado, el nombre, el cargo y los siete recuadros', () => {
    const { iniciales, nombre, cargo, recuadros } = renderEmpleado()

    expect(iniciales).toHaveAttribute('data-hue', String(employeeHue(3)))
    expect(nombre).toBeInTheDocument()
    expect(cargo).toBeInTheDocument()
    expect(recuadros.children).toHaveLength(7)
  })

  it('el orden es iniciales, nombre, cargo y recuadros', () => {
    const { tarjeta, iniciales, nombre, cargo, recuadros } = renderEmpleado()

    expect(antesQue(iniciales, nombre)).toBe(true)
    expect(antesQue(nombre, cargo)).toBe(true)
    expect(antesQue(cargo, recuadros)).toBe(true)
    // Los cuatro son hijos directos de la tarjeta, que los coloca en su rejilla.
    expect(Array.from(tarjeta.children)).toEqual([iniciales, nombre, cargo, recuadros])
  })

  it('el cargo y los recuadros llevan las clases que los colocan debajo, a todo el ancho de la tarjeta', () => {
    const { cargo, recuadros, nombre, iniciales } = renderEmpleado()

    expect(cargo).toHaveClass(styles.title)
    expect(recuadros).toHaveClass(styles.week)
    // El nombre y las iniciales se quedan en la primera fila.
    expect(nombre).not.toHaveClass(styles.week)
    expect(iniciales).not.toHaveClass(styles.week)
  })

  it('pasa "fill" y su clase a WeekLoad: el contenedor de los recuadros lleva la clase de relleno y la de la tarjeta', () => {
    const { recuadros } = renderEmpleado()

    expect(recuadros.className.split(/\s+/).filter(Boolean)).toEqual([weekStyles.week, weekStyles.fill, styles.week])
  })

  it('mantiene el texto accesible de los recuadros: "Assigned: Mon (2)"', () => {
    const { recuadros } = renderEmpleado(new Map([[LUNES, 2]]))

    expect(recuadros).toHaveAccessibleName('Assigned: Mon (2)')
    expect(Array.from(recuadros.children).map((recuadro) => recuadro.getAttribute('data-level'))).toEqual([
      '0',
      '2',
      '0',
      '0',
      '0',
      '0',
      '0',
    ])
  })

  it('sin programaciones el texto accesible es "Assigned: none" y el día actual sigue marcado', () => {
    const { recuadros } = renderEmpleado()

    expect(recuadros).toHaveAccessibleName('Assigned: none')
    expect(Array.from(recuadros.children).map((recuadro) => recuadro.hasAttribute('data-today'))).toEqual([
      false,
      false,
      true,
      false,
      false,
      false,
      false,
    ])
  })

  it('un supervisor muestra "Supervisor" como cargo en la misma posición', () => {
    const { tarjeta, cargo, recuadros } = renderEmpleado(undefined, empleado(3, 'Ana', 'López', 'Supervisor'))

    expect(cargo).toHaveTextContent('Supervisor')
    expect(tarjeta.children[2]).toBe(cargo)
    expect(tarjeta.children[3]).toBe(recuadros)
  })
})
