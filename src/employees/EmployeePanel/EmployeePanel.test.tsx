import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Employee, IsoDate, Schedule } from '../../api/types'
import { employeeHue } from '../../lib/colors'
import { createSeed } from '../../mocks/seed'
import { simularApisDeArrastre } from '../../test/dnd'
import { empleado, trabajo } from '../../test/fabricas'
import { programacionesConTrabajo } from '../../test/semilla'
import { EmployeePanel } from './EmployeePanel'

simularApisDeArrastre()

// El panel solo muestra a los empleados activos con cargo "Supervisor" o "Labor" (commit 7a084c0).
const ANA: Employee = empleado(3, 'Ana', 'López', 'Labor')
const PEDRO_INACTIVO: Employee = empleado(4, 'Pedro', 'Sánchez', 'Supervisor', 'Terminated')

const DIAS = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']
const SIGUIENTE = ['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14']
const HOY = '2026-11-03'

function renderPanel(
  employees: Employee[],
  error: Error | null = null,
  schedules: Schedule[] = [],
  days = DIAS,
  hours: Map<number, number> | undefined = undefined,
) {
  const resultado = render(
    <EmployeePanel employees={employees} error={error} schedules={schedules} days={days} today={HOY} hours={hours} />,
  )
  return { lista: screen.getByRole('list'), rerender: resultado.rerender }
}

let siguienteId = 100

/** Programación de "J-1024 Pintar oficina" el día `date` con los empleados `employeesIds`. */
function programacion(date: IsoDate, employeesIds: number[]): Schedule {
  return {
    jobSchedulesId: siguienteId++,
    job: trabajo(7, 'J-1024', 'Pintar oficina'),
    date,
    startTime: '07:00',
    employeesIds,
    scheduleComment: null,
  }
}

/** Siete recuadros de la fila (`role="img"`) y el contenedor con su texto accesible. */
function recuadros(fila: HTMLElement) {
  const contenedor = within(fila).getByRole('img')
  const niveles = Array.from(contenedor.children).map((recuadro) => recuadro.getAttribute('data-level'))
  return { contenedor, niveles }
}

/** Fila del panel que contiene el texto `nombre`. */
const fila = (lista: HTMLElement, nombre: string) => within(lista).getByText(nombre).closest('li') as HTMLElement

describe('EmployeePanel', () => {
  it('muestra el título "Employees"', () => {
    renderPanel([ANA])

    expect(screen.getByRole('heading', { level: 2, name: 'Employees' })).toBeInTheDocument()
  })

  describe('horas trabajadas de la semana', () => {
    const MARTA: Employee = empleado(1, 'Marta', 'Gómez', 'Supervisor')

    it('con un map muestra las horas del empleado presente y "0 h" al ausente', () => {
      const { lista } = renderPanel([MARTA, ANA], null, [], DIAS, new Map([[1, 32.5]]))

      expect(fila(lista, 'Marta Gómez')).toHaveTextContent('Supervisor · 32.5 h')
      expect(fila(lista, 'Ana López')).toHaveTextContent('Labor · 0 h')
    })

    it('con hours undefined (cargando o con error) no muestra horas ni alerta', () => {
      const { lista } = renderPanel([MARTA, ANA], null, [], DIAS, undefined)

      expect(fila(lista, 'Marta Gómez')).not.toHaveTextContent(/\bh\b/)
      expect(fila(lista, 'Ana López')).not.toHaveTextContent(/\bh\b/)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  it('escenario "Empleado inactivo": con Ana (Active) y Pedro (Terminated) muestra a Ana y no a Pedro', () => {
    const { lista } = renderPanel([ANA, PEDRO_INACTIVO])

    expect(within(lista).getAllByRole('listitem')).toHaveLength(1)
    expect(within(lista).getByText('Ana López')).toBeInTheDocument()
    expect(screen.queryByText('Pedro Sánchez')).not.toBeInTheDocument()
    expect(screen.queryByText('PS')).not.toBeInTheDocument()
  })

  it('con la semilla muestra los 7 Active con cargo Supervisor o Labor, sin Luis (Office) ni los 2 Terminated', () => {
    const { employees } = createSeed(new Date(2026, 10, 3))
    const { lista } = renderPanel(employees)

    expect(within(lista).getAllByRole('listitem')).toHaveLength(7)
    for (const nombre of [
      'Marta Gómez',
      'Jorge Pérez',
      'Ana López',
      'Pedro Sánchez',
      'Elena Díaz',
      'Sofía Romero',
      'Carlos Ruiz',
    ]) {
      expect(within(lista).getByText(nombre)).toBeInTheDocument()
    }
    expect(screen.queryByText('Luis Martínez')).not.toBeInTheDocument()
    expect(screen.queryByText('Raúl Torres')).not.toBeInTheDocument()
    expect(screen.queryByText('Lucía Navarro')).not.toBeInTheDocument()
  })

  it('con la semilla ordena primero los Supervisor y luego los Labor, cada grupo por nombre', () => {
    const { employees } = createSeed(new Date(2026, 10, 3))
    const { lista } = renderPanel(employees)

    const nombres = within(lista)
      .getAllByRole('listitem')
      .map((elemento) => within(elemento).getByText(/^\S+ \S+$/).textContent)
    expect(nombres).toEqual([
      'Marta Gómez',
      'Pedro Sánchez',
      'Ana López',
      'Carlos Ruiz',
      'Elena Díaz',
      'Jorge Pérez',
      'Sofía Romero',
    ])
  })

  it('no muestra a los empleados activos con un cargo distinto de Supervisor o Labor', () => {
    const { lista } = renderPanel([
      ANA,
      empleado(5, 'Luis', 'Martínez', 'Office'),
      empleado(6, 'Elena', 'Díaz', 'Driver'),
    ])

    expect(within(lista).getAllByRole('listitem')).toHaveLength(1)
    expect(screen.queryByText('Luis Martínez')).not.toBeInTheDocument()
    expect(screen.queryByText('Elena Díaz')).not.toBeInTheDocument()
  })

  it('acepta el cargo sin distinguir mayúsculas ni espacios alrededor', () => {
    const { lista } = renderPanel([
      empleado(1, 'Marta', 'Gómez', ' supervisor '),
      empleado(2, 'Jorge', 'Pérez', 'LABOR'),
    ])

    expect(within(lista).getAllByRole('listitem')).toHaveLength(2)
  })

  it('con el mismo cargo y nombre desempata por apellido', () => {
    const { lista } = renderPanel([
      empleado(12, 'Ana', 'Zapata', 'Labor'),
      ANA,
      empleado(11, 'Ana', 'Abad', 'Labor'),
    ])

    expect(
      within(lista)
        .getAllByRole('listitem')
        .map((elemento) => within(elemento).getByText(/^Ana /).textContent),
    ).toEqual(['Ana Abad', 'Ana López', 'Ana Zapata'])
  })

  it('cada fila muestra las iniciales, el nombre completo y el cargo: "AL", "Ana López", "Labor"', () => {
    const { lista } = renderPanel([ANA])

    const ana = fila(lista, 'Ana López')
    expect(within(ana).getByText('AL')).toBeInTheDocument()
    expect(within(ana).getByText('Ana López')).toBeInTheDocument()
    expect(within(ana).getByText('Labor')).toBeInTheDocument()
  })

  it('las iniciales salen en mayúsculas aunque el nombre llegue en minúsculas', () => {
    const { lista } = renderPanel([{ ...ANA, firstName: 'ana', lastName: 'lópez' }])

    expect(within(fila(lista, 'ana lópez')).getByText('AL')).toBeInTheDocument()
  })

  it('si todos son inactivos la lista queda vacía', () => {
    const { lista } = renderPanel([PEDRO_INACTIVO])

    expect(within(lista).queryAllByRole('listitem')).toHaveLength(0)
  })

  // Tarea 9.6: el avatar de cada empleado lleva su tono, el mismo que su chip en las tarjetas.
  it('el avatar con las iniciales lleva el tono del empleado', () => {
    const { lista } = renderPanel([ANA, { ...ANA, employeesId: 6, firstName: 'Elena', lastName: 'Díaz' }])

    expect(within(fila(lista, 'Ana López')).getByText('AL')).toHaveAttribute('data-hue', String(employeeHue(3)))
    expect(within(fila(lista, 'Elena Díaz')).getByText('ED')).toHaveAttribute('data-hue', String(employeeHue(6)))
  })

  it('con la semilla los 7 empleados del panel llevan 7 tonos distintos', () => {
    const { employees } = createSeed(new Date(2026, 10, 3))
    const { lista } = renderPanel(employees)

    const tonos = within(lista)
      .getAllByRole('listitem')
      .map((elemento) => elemento.querySelector('[data-hue]')?.getAttribute('data-hue'))
    expect(new Set(tonos).size).toBe(7)
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

  // Tareas 13.1 y 13.2: requisito "Días con trabajo en la semana visible" de
  // `specs/employee-assignment/spec.md`. Nivel 0 = vacío, 1 = tono claro, 2 = tono fuerte.
  describe('días con trabajo en la semana visible', () => {
    const JUAN: Employee = empleado(11, 'Juan', 'García', 'Labor')
    const LUNES = DIAS[1]
    const MARTES = DIAS[2]

    it('cada empleado muestra siete recuadros de domingo a sábado en su fila', () => {
      const { lista } = renderPanel([ANA, JUAN])

      for (const nombre of ['Ana López', 'Juan García']) {
        const { contenedor, niveles } = recuadros(fila(lista, nombre))
        expect(niveles).toHaveLength(7)
        expect(Array.from(contenedor.children).map((recuadro) => recuadro.textContent)).toEqual([
          'S',
          'M',
          'T',
          'W',
          'T',
          'F',
          'S',
        ])
      }
    })

    it('escenario "Juan asignado lunes y martes": lunes y martes en tono claro y los demás vacíos', () => {
      const { lista } = renderPanel([ANA, JUAN], null, [programacion(LUNES, [11]), programacion(MARTES, [11])])

      const { contenedor, niveles } = recuadros(fila(lista, 'Juan García'))
      expect(niveles).toEqual(['0', '1', '1', '0', '0', '0', '0'])
      expect(contenedor).toHaveAccessibleName('Assigned: Mon (1), Tue (1)')
      // Ana no está en esas programaciones.
      expect(recuadros(fila(lista, 'Ana López')).contenedor).toHaveAccessibleName('Assigned: none')
    })

    it('escenario "Dos trabajos el mismo día": con la semilla, el lunes de Ana (dos programaciones) en tono fuerte', () => {
      const semilla = createSeed(new Date(2026, 10, 3))
      const { lista } = renderPanel(semilla.employees, null, programacionesConTrabajo(semilla))

      const ana = recuadros(fila(lista, 'Ana López'))
      expect(ana.niveles).toEqual(['0', '2', '0', '0', '0', '0', '0'])
      expect(ana.contenedor).toHaveAccessibleName('Assigned: Mon (2)')
      // Carlos tiene una el martes: tono claro.
      expect(recuadros(fila(lista, 'Carlos Ruiz')).niveles).toEqual(['0', '0', '1', '0', '0', '0', '0'])
      expect(recuadros(fila(lista, 'Carlos Ruiz')).contenedor).toHaveAccessibleName('Assigned: Tue (1)')
      // Marta no tiene ninguna.
      expect(recuadros(fila(lista, 'Marta Gómez')).niveles).toEqual(['0', '0', '0', '0', '0', '0', '0'])
      expect(recuadros(fila(lista, 'Marta Gómez')).contenedor).toHaveAccessibleName('Assigned: none')
    })

    it('el texto accesible lista días y números en orden: "Assigned: Mon (1), Tue (2)"', () => {
      const { lista } = renderPanel([JUAN], null, [
        programacion(MARTES, [11]),
        programacion(LUNES, [11]),
        programacion(MARTES, [3, 11]),
      ])

      const { contenedor, niveles } = recuadros(fila(lista, 'Juan García'))
      expect(contenedor).toHaveAccessibleName('Assigned: Mon (1), Tue (2)')
      expect(niveles).toEqual(['0', '1', '2', '0', '0', '0', '0'])
    })

    it('marca el día actual (martes 3) en la fila de cada empleado', () => {
      const { lista } = renderPanel([ANA, JUAN])

      for (const nombre of ['Ana López', 'Juan García']) {
        const hoy = Array.from(recuadros(fila(lista, nombre)).contenedor.children).map((recuadro) =>
          recuadro.hasAttribute('data-today'),
        )
        expect(hoy).toEqual([false, false, true, false, false, false, false])
      }
    })

    it('escenario "Cambio de semana": en una semana sin programaciones de Juan, sus siete recuadros quedan vacíos', () => {
      const conTrabajo = [programacion(LUNES, [11]), programacion(MARTES, [11])]
      const { lista, rerender } = renderPanel([JUAN], null, conTrabajo)
      expect(recuadros(fila(lista, 'Juan García')).niveles).toEqual(['0', '1', '1', '0', '0', '0', '0'])

      rerender(
        <EmployeePanel employees={[JUAN]} error={null} schedules={[]} days={SIGUIENTE} today={HOY} hours={undefined} />,
      )

      const { contenedor, niveles } = recuadros(fila(screen.getByRole('list'), 'Juan García'))
      expect(niveles).toEqual(['0', '0', '0', '0', '0', '0', '0'])
      expect(contenedor).toHaveAccessibleName('Assigned: none')
      // La semana siguiente no contiene el día actual.
      expect(Array.from(contenedor.children).some((recuadro) => recuadro.hasAttribute('data-today'))).toBe(false)
    })

    it('al recibir programaciones nuevas se actualizan los recuadros (asignar a Juan el jueves)', () => {
      const { lista, rerender } = renderPanel([JUAN], null, [programacion(LUNES, [11])])
      expect(recuadros(fila(lista, 'Juan García')).niveles[4]).toBe('0')

      rerender(
        <EmployeePanel
          employees={[JUAN]}
          error={null}
          schedules={[programacion(LUNES, [11]), programacion(DIAS[4], [11])]}
          days={DIAS}
          today={HOY}
          hours={undefined}
        />,
      )

      const { contenedor, niveles } = recuadros(fila(screen.getByRole('list'), 'Juan García'))
      expect(niveles[4]).toBe('1')
      expect(contenedor).toHaveAccessibleName('Assigned: Mon (1), Thu (1)')
    })
  })
})
