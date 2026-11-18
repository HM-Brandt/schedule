// Tests de la tarjeta de una programación (tareas 5.2, 6.3, 7.5 y 9.6 de `schedule-assign`).
//
// Cubren "Solo hora de inicio" (escenario "Tarjeta con hora de inicio") de
// `specs/weekly-schedule-board/spec.md`, "Empleados en la tarjeta" y "Empleados que pasan a
// inactivos" de `specs/employee-assignment/spec.md`, y que la tarjeta y los chips de sus
// empleados activos se pueden arrastrar salvo mientras la programación tiene un id temporal
// (negativo), antes de que el servidor confirme su creación.
import { DragDropProvider } from '@dnd-kit/react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { trabajo } from '../../test/fabricas'
import type { Employee, Schedule } from '../../api/types'
import { employeeHue, jobHue } from '../../lib/colors'
import { createSeed } from '../../mocks/seed'
import { simularApisDeArrastre } from '../../test/dnd'
import { ScheduleCard } from './ScheduleCard'

simularApisDeArrastre()

const semilla = createSeed(new Date(2026, 10, 3))

/** Todos los empleados de la semilla por id: Ana López es el 3 y Luis Martínez el 5. */
const EMPLEADOS = new Map<number, Employee>(semilla.employees.map((empleado) => [empleado.employeesId, empleado]))

function programacion(cambios: Partial<Schedule> = {}): Schedule {
  return {
    jobSchedulesId: 1,
    job: trabajo(7, 'J-1024', 'Pintar oficina'),
    date: '2026-11-02',
    startTime: '07:00',
    employeesIds: [3, 5],
    scheduleComment: null,
    ...cambios,
  }
}

function renderTarjeta(schedule: Schedule, employeesById = EMPLEADOS) {
  render(<ScheduleCard schedule={schedule} employeesById={employeesById} />)
  return screen.getByRole('article')
}

/** Icono de comentario de la tarjeta, o `null` si no lo tiene. */
const iconoComentario = (tarjeta: HTMLElement) => within(tarjeta).queryByLabelText(/^Comment: /)

describe('ScheduleCard', () => {
  it('muestra el número, el nombre del trabajo y la hora de inicio "07:00"', () => {
    const tarjeta = renderTarjeta(programacion())

    expect(tarjeta).toHaveTextContent('J-1024')
    expect(tarjeta).toHaveTextContent('Pintar oficina')
    expect(screen.getByText('07:00')).toBeInTheDocument()
  })

  // El nombre se recorta a dos líneas con CSS; el nombre completo queda en la ayuda emergente.
  it('el nombre del trabajo lleva su nombre completo como ayuda emergente', () => {
    const nombre = 'Pintar oficina principal, pasillos, escaleras y fachada norte del edificio'
    const tarjeta = renderTarjeta(programacion({ job: trabajo(7, 'J-1024', nombre) }))

    const elemento = within(tarjeta).getByText(nombre)
    expect(elemento).toHaveAttribute('title', nombre)
  })

  it('no muestra ninguna hora de fin: una sola hora y ningún rango "HH:mm - HH:mm"', () => {
    const tarjeta = renderTarjeta(programacion())
    const texto = tarjeta.textContent ?? ''

    expect(texto.match(/\d{2}:\d{2}/g)).toEqual(['07:00'])
    expect(texto).not.toMatch(/\d{2}:\d{2}\s*[-–]\s*\d{2}:\d{2}/)
  })

  it('muestra otras horas tal como llegan, en 24 horas: "23:00"', () => {
    const tarjeta = renderTarjeta(programacion({ startTime: '23:00' }))

    expect((tarjeta.textContent ?? '').match(/\d{2}:\d{2}/g)).toEqual(['23:00'])
  })

  it('muestra las iniciales de cada empleado con su nombre completo al pasar el puntero', () => {
    renderTarjeta(programacion())

    expect(screen.getByTitle('Ana López')).toHaveTextContent('AL')
    expect(screen.getByTitle('Luis Martínez')).toHaveTextContent('LM')
  })

  it('muestra los empleados en el orden de la programación', () => {
    const tarjeta = renderTarjeta(programacion({ employeesIds: [5, 3] }))

    const iniciales = Array.from(tarjeta.querySelectorAll('span[title]')).map((elemento) => elemento.textContent)
    expect(iniciales).toEqual(['LM', 'AL'])
  })

  it('con empleados no muestra "No employees"', () => {
    renderTarjeta(programacion())

    expect(screen.queryByText('No employees')).not.toBeInTheDocument()
  })

  it('sin empleados indica "No employees" y no muestra iniciales', () => {
    const tarjeta = renderTarjeta(programacion({ employeesIds: [] }))

    expect(screen.getByText('No employees')).toBeInTheDocument()
    expect(tarjeta.querySelectorAll('span[title]')).toHaveLength(0)
  })

  it('omite los ids de empleado que no están en el mapa', () => {
    const tarjeta = renderTarjeta(programacion({ employeesIds: [3, 99] }))

    expect(screen.getByTitle('Ana López')).toHaveTextContent('AL')
    expect(tarjeta.querySelectorAll('span[title]')).toHaveLength(1)
    expect(screen.queryByText('No employees')).not.toBeInTheDocument()
  })

  it('con empleados asignados pero aún sin cargar no muestra "No employees" ni iniciales', () => {
    const tarjeta = renderTarjeta(programacion({ employeesIds: [3, 5] }), new Map())

    expect(screen.queryByText('No employees')).not.toBeInTheDocument()
    expect(tarjeta.querySelectorAll('span[title]')).toHaveLength(0)
  })

  // Tarea 12.2: "Comentario de una programación" de `specs/weekly-schedule-board/spec.md`.
  describe('comentario', () => {
    it('con comentario muestra el icono con el texto completo como ayuda emergente y "Comment: …" como nombre accesible', () => {
      const tarjeta = renderTarjeta(programacion({ scheduleComment: 'Llevar escalera' }))

      const icono = iconoComentario(tarjeta)
      expect(icono).toHaveAttribute('title', 'Llevar escalera')
      expect(icono).toHaveAccessibleName('Comment: Llevar escalera')
      expect(icono?.querySelector('svg')).not.toBeNull()
    })

    it('un comentario de varias líneas aparece entero en la ayuda emergente', () => {
      const tarjeta = renderTarjeta(programacion({ scheduleComment: 'Llevar escalera\nY rodillos' }))

      expect(iconoComentario(tarjeta)).toHaveAttribute('title', 'Llevar escalera\nY rodillos')
    })

    it('el texto del comentario no aparece en la tarjeta, solo en la ayuda emergente', () => {
      const tarjeta = renderTarjeta(programacion({ scheduleComment: 'Llevar escalera' }))

      expect(tarjeta).not.toHaveTextContent('Llevar escalera')
    })

    it('sin comentario no muestra el icono', () => {
      const tarjeta = renderTarjeta(programacion({ scheduleComment: null }))

      expect(iconoComentario(tarjeta)).toBeNull()
      expect(tarjeta.querySelectorAll('span[title]')).toHaveLength(2)
    })

    it('al borrar el comentario el icono desaparece', () => {
      const { rerender } = render(
        <ScheduleCard schedule={programacion({ scheduleComment: 'Llevar escalera' })} employeesById={EMPLEADOS} />,
      )
      expect(iconoComentario(screen.getByRole('article'))).not.toBeNull()

      rerender(<ScheduleCard schedule={programacion({ scheduleComment: null })} employeesById={EMPLEADOS} />)

      expect(iconoComentario(screen.getByRole('article'))).toBeNull()
    })

    it('al agregar un comentario el icono aparece', () => {
      const { rerender } = render(<ScheduleCard schedule={programacion()} employeesById={EMPLEADOS} />)
      expect(iconoComentario(screen.getByRole('article'))).toBeNull()

      rerender(<ScheduleCard schedule={programacion({ scheduleComment: 'Llevar andamio' })} employeesById={EMPLEADOS} />)

      expect(iconoComentario(screen.getByRole('article'))).toHaveAttribute('title', 'Llevar andamio')
    })

    it('el icono no cambia las iniciales de los empleados', () => {
      renderTarjeta(programacion({ scheduleComment: 'Llevar escalera' }))

      expect(screen.getByTitle('Ana López')).toHaveTextContent('AL')
      expect(screen.getByTitle('Luis Martínez')).toHaveTextContent('LM')
      expect(screen.queryByText('No employees')).not.toBeInTheDocument()
    })

    // Tarea 14.2: el icono va en la fila superior, junto al número del trabajo, y las iniciales
    // no cambian por tener comentario. La posición en la esquina (CSS) se comprueba en los e2e.
    it('el icono está en la fila superior, la misma que el número y la hora, después de ellos', () => {
      const tarjeta = renderTarjeta(programacion({ scheduleComment: 'Llevar escalera' }))

      const numero = within(tarjeta).getByText('J-1024')
      const filaSuperior = numero.parentElement as HTMLElement
      const icono = iconoComentario(tarjeta) as HTMLElement
      expect(icono.parentElement).toBe(filaSuperior)
      expect(within(filaSuperior).getByText('07:00')).toBeInTheDocument()
      expect(numero.compareDocumentPosition(icono) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      // La fila superior es la primera de la tarjeta.
      expect(tarjeta.firstElementChild).toBe(filaSuperior)
    })

    it('el icono no está en la fila de las iniciales ni en la del nombre', () => {
      const tarjeta = renderTarjeta(programacion({ scheduleComment: 'Llevar escalera' }))

      const filaDeIniciales = screen.getByTitle('Ana López').parentElement as HTMLElement
      const icono = iconoComentario(tarjeta) as HTMLElement
      expect(filaDeIniciales.contains(icono)).toBe(false)
      expect(within(tarjeta).getByText('Pintar oficina').contains(icono)).toBe(false)
    })

    it('en teléfono el icono queda en la fila superior antes del botón de asignar', () => {
      render(
        <ScheduleCard
          schedule={programacion({ scheduleComment: 'Llevar escalera' })}
          employeesById={EMPLEADOS}
          onAssign={vi.fn()}
        />,
      )
      const tarjeta = screen.getByRole('article')

      const icono = iconoComentario(tarjeta) as HTMLElement
      const asignar = within(tarjeta).getByRole('button', { name: 'Assign employees' })
      expect(asignar.parentElement).toBe(icono.parentElement)
      expect(icono.compareDocumentPosition(asignar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('la fila de iniciales es idéntica con y sin comentario', () => {
      const { rerender } = render(<ScheduleCard schedule={programacion()} employeesById={EMPLEADOS} />)
      const sinComentario = (screen.getByTitle('Ana López').parentElement as HTMLElement).outerHTML

      rerender(<ScheduleCard schedule={programacion({ scheduleComment: 'Llevar escalera' })} employeesById={EMPLEADOS} />)

      expect((screen.getByTitle('Ana López').parentElement as HTMLElement).outerHTML).toBe(sinComentario)
    })

    it('con más de cuatro empleados y comentario sigue mostrando cuatro iniciales y "+N"', () => {
      const tarjeta = renderTarjeta(programacion({ employeesIds: [1, 2, 3, 4, 5, 6], scheduleComment: 'Llevar escalera' }))

      const filaDeIniciales = screen.getByTitle('Marta Gómez').parentElement as HTMLElement
      expect(filaDeIniciales.children).toHaveLength(5)
      expect(within(filaDeIniciales).getByText('+2')).toBeInTheDocument()
      expect(iconoComentario(tarjeta)).not.toBeNull()
    })
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
      const { tarjeta, alEmpezar } = renderArrastrable(programacion({ jobSchedulesId: 1 }))

      await waitFor(() => expect(tarjeta).toHaveAttribute('aria-disabled', 'false'))
      pulsarEspacio(tarjeta)

      await waitFor(() => expect(alEmpezar).toHaveBeenCalledTimes(1))
    })

    it('con un id temporal negativo no se puede arrastrar', async () => {
      const { tarjeta, alEmpezar } = renderArrastrable(programacion({ jobSchedulesId: -1 }))

      await waitFor(() => expect(tarjeta).toHaveAttribute('aria-disabled', 'true'))
      pulsarEspacio(tarjeta)

      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(alEmpezar).not.toHaveBeenCalled()
    })
  })

  // Tarea 7.5: "Empleados en la tarjeta" (escenario "Muchos empleados") de
  // `specs/employee-assignment/spec.md`. En la semilla los ids 1 a 6 son Marta Gómez,
  // Jorge Pérez, Ana López, Pedro Sánchez, Luis Martínez y Elena Díaz.
  describe('más empleados de los que caben', () => {
    /** Textos de las iniciales y del indicador "+N" de la tarjeta, en orden. */
    const indicadoresDeEmpleados = (tarjeta: HTMLElement) =>
      Array.from(tarjeta.querySelectorAll('span[title]')).map((elemento) => elemento.textContent)

    it('escenario "Muchos empleados": con seis muestra cuatro iniciales y el indicador "+2"', () => {
      const tarjeta = renderTarjeta(programacion({ employeesIds: [1, 2, 3, 4, 5, 6] }))

      expect(indicadoresDeEmpleados(tarjeta)).toEqual(['MG', 'JP', 'AL', 'PS', '+2'])
    })

    it('el "+2" lista al pasar el puntero los nombres de los dos ocultos', () => {
      renderTarjeta(programacion({ employeesIds: [1, 2, 3, 4, 5, 6] }))

      expect(screen.getByText('+2')).toHaveAttribute('title', 'Luis Martínez, Elena Díaz')
      expect(screen.queryByTitle('Luis Martínez')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Elena Díaz')).not.toBeInTheDocument()
    })

    it('con cinco muestra cuatro iniciales y "+1" con el nombre del oculto', () => {
      const tarjeta = renderTarjeta(programacion({ employeesIds: [1, 2, 3, 4, 5] }))

      expect(indicadoresDeEmpleados(tarjeta)).toEqual(['MG', 'JP', 'AL', 'PS', '+1'])
      expect(screen.getByText('+1')).toHaveAttribute('title', 'Luis Martínez')
    })

    it('con cuatro, que caben, muestra las cuatro iniciales y ningún "+N"', () => {
      const tarjeta = renderTarjeta(programacion({ employeesIds: [1, 2, 3, 4] }))

      expect(indicadoresDeEmpleados(tarjeta)).toEqual(['MG', 'JP', 'AL', 'PS'])
      expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument()
    })
  })

  // Tarea 7.5: "Empleados que pasan a inactivos" (escenario "Asignación previa a la baja") de
  // `specs/employee-assignment/spec.md`.
  describe('empleado asignado que pasó a inactivo', () => {
    /** La semilla con Pedro Sánchez (4) dado de baja. */
    const CON_PEDRO_INACTIVO = new Map(EMPLEADOS)
    CON_PEDRO_INACTIVO.set(4, { ...EMPLEADOS.get(4)!, status: 'Terminated' })

    /** Programación del martes con Pedro (inactivo) y Ana (activa). */
    const delMartes = (cambios: Partial<Schedule> = {}) =>
      programacion({ date: '2026-11-03', employeesIds: [4, 3], ...cambios })

    it('escenario "Asignación previa a la baja": la tarjeta del martes sigue mostrando a Pedro marcado "(inactive)"', () => {
      renderTarjeta(delMartes(), CON_PEDRO_INACTIVO)

      expect(screen.getByTitle('Pedro Sánchez (inactive)')).toHaveTextContent('PS')
      expect(screen.queryByTitle('Pedro Sánchez')).not.toBeInTheDocument()
      // Ana, activa, se muestra sin la marca.
      expect(screen.getByTitle('Ana López')).toHaveTextContent('AL')
    })

    it('un inactivo oculto tras el "+N" también aparece en su lista de nombres', () => {
      renderTarjeta(programacion({ employeesIds: [1, 2, 3, 5, 4] }), CON_PEDRO_INACTIVO)

      expect(screen.getByText('+1')).toHaveAttribute('title', 'Pedro Sánchez')
    })

    describe('arrastre de los chips de empleado', () => {
      /** Monta la tarjeta en un proveedor de arrastre y anota el tipo y los datos de cada arrastre que empieza. */
      function renderConProveedor(schedule: Schedule) {
        const arrastres: { tipo: unknown; datos: unknown }[] = []
        render(
          <DragDropProvider
            onDragStart={(event) =>
              arrastres.push({ tipo: event.operation.source?.type, datos: event.operation.source?.data })
            }
          >
            <ScheduleCard schedule={schedule} employeesById={CON_PEDRO_INACTIVO} />
          </DragDropProvider>,
        )
        return arrastres
      }

      function pulsarEspacio(elemento: HTMLElement) {
        elemento.focus()
        fireEvent.keyDown(elemento, { key: ' ', code: 'Space' })
      }

      const arrastresDeEmpleado = (arrastres: { tipo: unknown }[]) =>
        arrastres.filter((arrastre) => arrastre.tipo === 'employee')

      it('el chip de Ana, activa, se puede arrastrar como empleado de esa programación', async () => {
        const arrastres = renderConProveedor(delMartes())
        const ana = screen.getByTitle('Ana López')

        await waitFor(() => expect(ana).toHaveAttribute('aria-disabled', 'false'))
        pulsarEspacio(ana)

        await waitFor(() => expect(arrastresDeEmpleado(arrastres)).toHaveLength(1))
        expect(arrastresDeEmpleado(arrastres)[0]).toEqual({
          tipo: 'employee',
          datos: { kind: 'employee', employeeId: 3, fromScheduleId: 1 },
        })
      })

      it('el chip de Pedro, inactivo, no se puede arrastrar', async () => {
        const arrastres = renderConProveedor(delMartes())
        const pedro = screen.getByTitle('Pedro Sánchez (inactive)')
        // Se espera a que el chip de Ana esté registrado, para comparar en igualdad de condiciones.
        await waitFor(() => expect(screen.getByTitle('Ana López')).toHaveAttribute('aria-disabled', 'false'))

        expect(pedro).not.toHaveAttribute('aria-disabled')
        pulsarEspacio(pedro)

        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(arrastresDeEmpleado(arrastres)).toEqual([])
      })

      it('con un id temporal negativo el chip de Ana, activa, no se puede arrastrar', async () => {
        const arrastres = renderConProveedor(delMartes({ jobSchedulesId: -1 }))
        const ana = screen.getByTitle('Ana López')

        await waitFor(() => expect(ana).toHaveAttribute('aria-disabled', 'true'))
        pulsarEspacio(ana)

        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(arrastres).toEqual([])
      })
    })
  })

  // Tarea 9.6: color por trabajo y por empleado. El tono se aplica con `data-hue`.
  describe('tonos', () => {
    it('la tarjeta lleva el tono de su trabajo', () => {
      const tarjeta = renderTarjeta(programacion())

      expect(tarjeta).toHaveAttribute('data-hue', String(jobHue(7)))
    })

    it('dos trabajos distintos con tonos distintos se pintan distinto', () => {
      render(
        <>
          <ScheduleCard schedule={programacion({ jobSchedulesId: 1, job: trabajo(1, 'J-1', 'Uno') })} employeesById={EMPLEADOS} />
          <ScheduleCard schedule={programacion({ jobSchedulesId: 2, job: trabajo(2, 'J-2', 'Dos') })} employeesById={EMPLEADOS} />
        </>,
      )
      const [primera, segunda] = screen.getAllByRole('article')

      expect(primera).toHaveAttribute('data-hue', String(jobHue(1)))
      expect(segunda).toHaveAttribute('data-hue', String(jobHue(2)))
      expect(primera.getAttribute('data-hue')).not.toBe(segunda.getAttribute('data-hue'))
    })

    it('el chip de cada empleado activo lleva el tono de ese empleado', () => {
      renderTarjeta(programacion({ employeesIds: [3, 5] }))

      expect(screen.getByTitle('Ana López')).toHaveAttribute('data-hue', String(employeeHue(3)))
      expect(screen.getByTitle('Luis Martínez')).toHaveAttribute('data-hue', String(employeeHue(5)))
    })

    it('el tono del chip depende del empleado, no del trabajo', () => {
      renderTarjeta(programacion({ job: trabajo(2, 'J-2', 'Dos'), employeesIds: [3] }))

      expect(screen.getByTitle('Ana López')).toHaveAttribute('data-hue', String(employeeHue(3)))
    })

    it('el chip de un inactivo no lleva tono propio y va con el estilo de inactivo', () => {
      const conPedroInactivo = new Map(EMPLEADOS)
      conPedroInactivo.set(4, { ...EMPLEADOS.get(4)!, status: 'Terminated' })
      renderTarjeta(programacion({ employeesIds: [4, 3] }), conPedroInactivo)

      const pedro = screen.getByTitle('Pedro Sánchez (inactive)')
      expect(pedro).not.toHaveAttribute('data-hue')
      expect(pedro).toHaveClass(/inactive/)
      expect(screen.getByTitle('Ana López')).not.toHaveClass(/inactive/)
    })

    it('el indicador "+N" no lleva tono', () => {
      renderTarjeta(programacion({ employeesIds: [1, 2, 3, 4, 5, 6] }))

      expect(screen.getByText('+2')).not.toHaveAttribute('data-hue')
    })
  })
})
