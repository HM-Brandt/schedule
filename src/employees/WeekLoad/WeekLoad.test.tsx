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
import type { Absence, IsoDate } from '../../api/types'
import { WeekLoad } from './WeekLoad'
import styles from './WeekLoad.module.css'

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

  // Tarea 6.1 de `employee-absences`: un día ausente usa el nivel `absent` y el texto accesible
  // añade ". Absent: " con los días ausentes y su tipo.
  describe('días de ausencia', () => {
    const ausencia = (date: IsoDate, absenceType: Absence['absenceType']): [IsoDate, Absence] => [
      date,
      { employeeAbsencesId: 1, employeesId: 11, date, absenceType, absenceComment: null },
    ]

    it('escenario "Juan de vacaciones el martes": lunes en tono claro, martes "absent" y el texto lo indica', () => {
      render(
        <WeekLoad days={DIAS} today={MARTES} load={new Map([[LUNES, 1]])} absences={new Map([ausencia(MARTES, 'Vacation')])} />,
      )
      const contenedor = screen.getByRole('img')
      const recuadros = Array.from(contenedor.children) as HTMLElement[]

      expect(niveles(recuadros)).toEqual(['0', '1', 'absent', '0', '0', '0', '0'])
      expect(contenedor).toHaveAccessibleName('Assigned: Mon (1). Absent: Tue (Vacation)')
    })

    it('varias ausencias se listan separadas por coma en orden de la semana', () => {
      render(
        <WeekLoad
          days={DIAS}
          today={MARTES}
          load={undefined}
          absences={new Map([ausencia(JUEVES, 'Sick'), ausencia(MARTES, 'Vacation')])}
        />,
      )

      expect(screen.getByRole('img')).toHaveAccessibleName('Assigned: none. Absent: Tue (Vacation), Thu (Sick)')
    })

    it('el estilo de ausencia sustituye al tono de carga del mismo día', () => {
      render(<WeekLoad days={DIAS} today={MARTES} load={new Map([[LUNES, 2]])} absences={new Map([ausencia(LUNES, 'Off')])} />)

      const recuadros = Array.from(screen.getByRole('img').children) as HTMLElement[]
      expect(recuadros[1]).toHaveAttribute('data-level', 'absent')
    })

    it('sin ausencias o con un mapa vacío el texto accesible no cambia y ningún recuadro es "absent"', () => {
      const { unmount } = render(<WeekLoad days={DIAS} today={MARTES} load={new Map([[LUNES, 1]])} absences={new Map()} />)
      expect(screen.getByRole('img')).toHaveAccessibleName('Assigned: Mon (1)')
      expect(niveles(Array.from(screen.getByRole('img').children) as HTMLElement[])).not.toContain('absent')
      unmount()

      render(<WeekLoad days={DIAS} today={MARTES} load={new Map([[LUNES, 1]])} />)
      expect(screen.getByRole('img')).toHaveAccessibleName('Assigned: Mon (1)')
    })

    it('ignora las ausencias de fechas fuera de la semana visible', () => {
      render(<WeekLoad days={DIAS} today={MARTES} load={undefined} absences={new Map([ausencia('2026-11-09', 'Off')])} />)

      expect(screen.getByRole('img')).toHaveAccessibleName('Assigned: none')
    })

    it('el día actual ausente conserva la marca de hoy', () => {
      render(<WeekLoad days={DIAS} today={MARTES} load={undefined} absences={new Map([ausencia(MARTES, 'Other')])} />)

      const recuadros = Array.from(screen.getByRole('img').children) as HTMLElement[]
      expect(recuadros[2]).toHaveAttribute('data-level', 'absent')
      expect(recuadros[2]).toHaveAttribute('data-today')
    })
  })

  // Variante que reparte los siete recuadros a todo el ancho de la fila del empleado
  // (`design.md`: "Los recuadros de días con trabajo de cada empleado se adaptan al ancho de su
  // fila"). La usa `EmployeeItem`; `AssignSheet` sigue con la variante de siempre.
  describe('props opcionales "fill" y "className"', () => {
    const clases = (elemento: HTMLElement) => elemento.className.split(/\s+/).filter(Boolean)

    it('sin "fill" ni "className" el contenedor solo lleva la clase de siempre', () => {
      const { contenedor } = renderSemana(undefined)

      expect(clases(contenedor)).toEqual([styles.week])
      expect(contenedor).not.toHaveClass(styles.fill)
    })

    it('con "fill" el contenedor lleva además la clase de relleno', () => {
      render(<WeekLoad days={DIAS} today={MARTES} load={undefined} fill />)

      expect(clases(screen.getByRole('img'))).toEqual([styles.week, styles.fill])
    })

    it('con "fill={false}" no añade la clase de relleno', () => {
      render(<WeekLoad days={DIAS} today={MARTES} load={undefined} fill={false} />)

      expect(clases(screen.getByRole('img'))).toEqual([styles.week])
    })

    it('"className" se suma a las clases del contenedor sin quitar la de siempre', () => {
      render(<WeekLoad days={DIAS} today={MARTES} load={undefined} className="fila-del-empleado" />)

      expect(clases(screen.getByRole('img'))).toEqual([styles.week, 'fila-del-empleado'])
    })

    it('con "fill" y "className" el contenedor lleva las tres clases', () => {
      render(<WeekLoad days={DIAS} today={MARTES} load={undefined} fill className="fila-del-empleado" />)

      expect(clases(screen.getByRole('img'))).toEqual([styles.week, styles.fill, 'fila-del-empleado'])
    })

    it('con "fill" mantiene los siete recuadros, sus niveles, el día actual y el texto accesible', () => {
      render(
        <WeekLoad
          days={DIAS}
          today={MARTES}
          load={
            new Map([
              [LUNES, 2],
              [MARTES, 1],
            ])
          }
          fill
          className="fila-del-empleado"
        />,
      )

      const contenedor = screen.getByRole('img')
      const recuadros = Array.from(contenedor.children) as HTMLElement[]
      expect(contenedor).toHaveAccessibleName('Assigned: Mon (2), Tue (1)')
      expect(recuadros.map((recuadro) => recuadro.textContent)).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S'])
      expect(niveles(recuadros)).toEqual(['0', '2', '1', '0', '0', '0', '0'])
      expect(recuadros[2]).toHaveAttribute('data-today')
      for (const recuadro of recuadros) expect(recuadro).toHaveAttribute('aria-hidden', 'true')
    })
  })
})
