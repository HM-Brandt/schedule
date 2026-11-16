// Tests de los siete recuadros de días con trabajo de un empleado (tarea 13.1 de `schedule-assign`).
//
// Cubren el requisito "Días con trabajo en la semana visible" de
// `specs/employee-assignment/spec.md`: siete recuadros de domingo a sábado, vacío sin
// programaciones, tono claro con una, tono fuerte con dos o más, borde en el día actual y un
// texto accesible con los días asignados y su número ("Assigned: Mon (1), Tue (2)").
//
// El tono se expone en `data-level` (0, 1 o 2) y el día actual en `data-today`; los recuadros
// son decorativos (`aria-hidden`) y el texto accesible va en el contenedor (`role="img"`).
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { IsoDate } from '../../api/types'
import { WeekLoad } from './WeekLoad'

const DIAS = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']
const DOMINGO = DIAS[0]
const LUNES = DIAS[1]
const MARTES = DIAS[2]
const JUEVES = DIAS[4]
const SABADO = DIAS[6]

function renderSemana(load: Map<IsoDate, number> | undefined, today: IsoDate = MARTES, days: IsoDate[] = DIAS) {
  render(<WeekLoad days={days} today={today} load={load} />)
  const contenedor = screen.getByRole('img')
  const recuadros = Array.from(contenedor.children) as HTMLElement[]
  return { contenedor, recuadros }
}

const niveles = (recuadros: HTMLElement[]) => recuadros.map((recuadro) => recuadro.getAttribute('data-level'))

describe('WeekLoad', () => {
  it('muestra siete recuadros de domingo a sábado con la inicial de cada día', () => {
    const { recuadros } = renderSemana(undefined)

    expect(recuadros).toHaveLength(7)
    expect(recuadros.map((recuadro) => recuadro.textContent)).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S'])
  })

  it('los recuadros son decorativos: están ocultos a la accesibilidad', () => {
    const { recuadros } = renderSemana(new Map([[LUNES, 1]]))

    for (const recuadro of recuadros) expect(recuadro).toHaveAttribute('aria-hidden', 'true')
  })

  it('sin programaciones los siete recuadros quedan vacíos (nivel 0) y el texto es "Assigned: none"', () => {
    const { contenedor, recuadros } = renderSemana(undefined)

    expect(niveles(recuadros)).toEqual(['0', '0', '0', '0', '0', '0', '0'])
    expect(contenedor).toHaveAccessibleName('Assigned: none')
  })

  it('con un mapa vacío también indica "Assigned: none"', () => {
    const { contenedor, recuadros } = renderSemana(new Map())

    expect(niveles(recuadros)).toEqual(['0', '0', '0', '0', '0', '0', '0'])
    expect(contenedor).toHaveAccessibleName('Assigned: none')
  })

  it('escenario "Juan asignado lunes y martes": lunes y martes en tono claro y los demás vacíos', () => {
    const { contenedor, recuadros } = renderSemana(
      new Map([
        [LUNES, 1],
        [MARTES, 1],
      ]),
    )

    expect(niveles(recuadros)).toEqual(['0', '1', '1', '0', '0', '0', '0'])
    expect(contenedor).toHaveAccessibleName('Assigned: Mon (1), Tue (1)')
  })

  it('escenario "Dos trabajos el mismo día": dos programaciones el lunes dan tono fuerte (nivel 2)', () => {
    const { recuadros } = renderSemana(new Map([[LUNES, 2]]))

    expect(recuadros[1]).toHaveAttribute('data-level', '2')
  })

  it('tres o más programaciones en un día siguen en tono fuerte (nivel 2) y el texto da el número real', () => {
    const { contenedor, recuadros } = renderSemana(new Map([[JUEVES, 3]]))

    expect(recuadros[4]).toHaveAttribute('data-level', '2')
    expect(contenedor).toHaveAccessibleName('Assigned: Thu (3)')
  })

  it('el texto accesible lista los días en orden de domingo a sábado con su número: "Assigned: Mon (1), Tue (2)"', () => {
    // Se insertan desordenados en el mapa: el orden lo da la semana.
    const { contenedor } = renderSemana(
      new Map([
        [MARTES, 2],
        [LUNES, 1],
      ]),
    )

    expect(contenedor).toHaveAccessibleName('Assigned: Mon (1), Tue (2)')
  })

  it('incluye domingo y sábado en el texto cuando tienen programaciones', () => {
    const { contenedor, recuadros } = renderSemana(
      new Map([
        [SABADO, 1],
        [DOMINGO, 2],
      ]),
    )

    expect(niveles(recuadros)).toEqual(['2', '0', '0', '0', '0', '0', '1'])
    expect(contenedor).toHaveAccessibleName('Assigned: Sun (2), Sat (1)')
  })

  it('ignora las fechas del mapa que no son de la semana visible', () => {
    const { contenedor, recuadros } = renderSemana(new Map([['2026-11-09', 2]]))

    expect(niveles(recuadros)).toEqual(['0', '0', '0', '0', '0', '0', '0'])
    expect(contenedor).toHaveAccessibleName('Assigned: none')
  })

  it('marca con "data-today" solo el recuadro del día actual', () => {
    const { recuadros } = renderSemana(undefined, MARTES)

    expect(recuadros.map((recuadro) => recuadro.hasAttribute('data-today'))).toEqual([
      false,
      false,
      true,
      false,
      false,
      false,
      false,
    ])
  })

  it('el día actual conserva su nivel: con dos programaciones el martes, nivel 2 y marcado como hoy', () => {
    const { recuadros } = renderSemana(new Map([[MARTES, 2]]), MARTES)

    expect(recuadros[2]).toHaveAttribute('data-level', '2')
    expect(recuadros[2]).toHaveAttribute('data-today')
  })

  it('en una semana que no contiene el día actual ningún recuadro lleva "data-today"', () => {
    const siguiente = ['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14']
    const { recuadros } = renderSemana(undefined, MARTES, siguiente)

    expect(recuadros.some((recuadro) => recuadro.hasAttribute('data-today'))).toBe(false)
  })
})
