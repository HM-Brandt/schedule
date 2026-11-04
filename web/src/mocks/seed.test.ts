// Tests de los datos semilla de MSW (tarea 3.1 de `schedule-assign`).
//
// `today` es el martes 2026-11-03 a medianoche local: su semana domingo-sábado va
// del 2026-11-01 al 2026-11-07.
import { describe, expect, it } from 'vitest'
import { createSeed } from './seed'

const HOY = new Date(2026, 10, 3)
const DESDE = '2026-11-01'
const HASTA = '2026-11-07'

describe('createSeed', () => {
  it('tiene 10 empleados con ids distintos', () => {
    const { employees } = createSeed(HOY)

    expect(employees).toHaveLength(10)
    expect(new Set(employees.map((empleado) => empleado.id)).size).toBe(10)
  })

  it('tiene exactamente 2 empleados inactivos y el resto activos', () => {
    const { employees } = createSeed(HOY)

    expect(employees.filter((empleado) => empleado.status === 'inactivo')).toHaveLength(2)
    expect(employees.filter((empleado) => empleado.status === 'activo')).toHaveLength(8)
  })

  it('los empleados tienen la forma {id, first_name, last_name, title, status}', () => {
    const { employees } = createSeed(HOY)

    for (const empleado of employees) {
      expect(Object.keys(empleado).sort()).toEqual(
        ['first_name', 'id', 'last_name', 'status', 'title'].sort(),
      )
      expect(empleado.first_name).not.toBe('')
      expect(empleado.last_name).not.toBe('')
    }
  })

  it('tiene unos 30 trabajos con ids y números distintos', () => {
    const { jobs } = createSeed(HOY)

    expect(jobs.length).toBeGreaterThanOrEqual(25)
    expect(jobs.length).toBeLessThanOrEqual(35)
    expect(new Set(jobs.map((trabajo) => trabajo.id)).size).toBe(jobs.length)
    expect(new Set(jobs.map((trabajo) => trabajo.number)).size).toBe(jobs.length)
  })

  it('incluye el trabajo 7 "J-1024 Pintar oficina" del spec', () => {
    const { jobs } = createSeed(HOY)

    expect(jobs.find((trabajo) => trabajo.id === 7)).toEqual({
      id: 7,
      number: 'J-1024',
      name: 'Pintar oficina',
    })
  })

  it('tiene programaciones y todas caen en la semana domingo-sábado de today', () => {
    const { schedules } = createSeed(HOY)

    expect(schedules.length).toBeGreaterThan(0)
    for (const programacion of schedules) {
      expect(programacion.date >= DESDE && programacion.date <= HASTA).toBe(true)
    }
  })

  it('las programaciones se mueven con la semana de today', () => {
    // Sábado 2026-11-14: semana del 2026-11-08 al 2026-11-14.
    const { schedules } = createSeed(new Date(2026, 10, 14))

    for (const programacion of schedules) {
      expect(programacion.date >= '2026-11-08' && programacion.date <= '2026-11-14').toBe(true)
    }
  })

  it('el domingo usa su propia semana y no la anterior', () => {
    const { schedules } = createSeed(new Date(2026, 10, 1))

    for (const programacion of schedules) {
      expect(programacion.date >= DESDE && programacion.date <= HASTA).toBe(true)
    }
  })

  it('las programaciones tienen ids distintos, hora HH:mm y un trabajo del catálogo', () => {
    const { jobs, schedules } = createSeed(HOY)

    expect(new Set(schedules.map((programacion) => programacion.id)).size).toBe(schedules.length)
    for (const programacion of schedules) {
      expect(programacion.start_time).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/)
      expect(jobs).toContainEqual(programacion.job)
    }
  })

  it('hay un trabajo repetido el mismo día', () => {
    const { schedules } = createSeed(HOY)
    const claves = schedules.map((programacion) => `${programacion.job.id}|${programacion.date}`)

    expect(new Set(claves).size).toBeLessThan(claves.length)
  })

  it('hay un empleado con dos programaciones el mismo día', () => {
    const { schedules } = createSeed(HOY)
    const cuenta = new Map<string, number>()
    for (const programacion of schedules) {
      for (const id of programacion.employee_ids) {
        const clave = `${id}|${programacion.date}`
        cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1)
      }
    }

    expect(Math.max(0, ...cuenta.values())).toBeGreaterThanOrEqual(2)
  })

  it('los employee_ids de las programaciones existen y no se repiten', () => {
    const { employees, schedules } = createSeed(HOY)
    const ids = new Set(employees.map((empleado) => empleado.id))

    for (const programacion of schedules) {
      expect(new Set(programacion.employee_ids).size).toBe(programacion.employee_ids.length)
      for (const id of programacion.employee_ids) {
        expect(ids.has(id)).toBe(true)
      }
    }
  })
})
