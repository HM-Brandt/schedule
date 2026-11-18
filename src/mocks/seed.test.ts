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
    expect(new Set(employees.map((empleado) => empleado.employeesId)).size).toBe(10)
  })

  it('tiene exactamente 2 empleados Terminated (el 9 y el 10) y el resto Active', () => {
    const { employees } = createSeed(HOY)

    const inactivos = employees.filter((empleado) => empleado.status === 'Terminated')
    expect(inactivos).toHaveLength(2)
    expect(inactivos.map((empleado) => empleado.employeesId).sort((a, b) => a - b)).toEqual([9, 10])
    expect(employees.filter((empleado) => empleado.status === 'Active')).toHaveLength(8)
  })

  it('los empleados tienen la forma {employeesId, legalName, employeeNumber, firstName, lastName, status, title, user}', () => {
    const { employees } = createSeed(HOY)

    for (const empleado of employees) {
      expect(Object.keys(empleado).sort()).toEqual(
        ['employeesId', 'legalName', 'employeeNumber', 'firstName', 'lastName', 'status', 'title', 'user'].sort(),
      )
      expect(empleado.firstName).not.toBe('')
      expect(empleado.lastName).not.toBe('')
    }
  })

  it('tiene unos 30 trabajos con ids y números distintos', () => {
    const { jobs } = createSeed(HOY)

    expect(jobs.length).toBeGreaterThanOrEqual(25)
    expect(jobs.length).toBeLessThanOrEqual(35)
    expect(new Set(jobs.map((trabajo) => trabajo.jobsId)).size).toBe(jobs.length)
    expect(new Set(jobs.map((trabajo) => trabajo.number)).size).toBe(jobs.length)
  })

  it('los trabajos tienen la forma {jobsId, number, type, name, address, contractor, contact, status, user}', () => {
    const { jobs } = createSeed(HOY)

    for (const trabajo of jobs) {
      expect(Object.keys(trabajo).sort()).toEqual(
        ['jobsId', 'number', 'type', 'name', 'address', 'contractor', 'contact', 'status', 'user'].sort(),
      )
    }
  })

  it('tiene al menos un trabajo con status "Done" y el resto "Open"', () => {
    const { jobs } = createSeed(HOY)

    expect(jobs.filter((trabajo) => trabajo.status === 'Done').length).toBeGreaterThanOrEqual(1)
    expect(jobs.every((trabajo) => trabajo.status === 'Done' || trabajo.status === 'Open')).toBe(true)
  })

  it('incluye el trabajo 7 "J-1024 Pintar oficina" del spec, abierto', () => {
    const { jobs } = createSeed(HOY)

    expect(jobs.find((trabajo) => trabajo.jobsId === 7)).toMatchObject({
      jobsId: 7,
      number: 'J-1024',
      name: 'Pintar oficina',
      status: 'Open',
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

    expect(new Set(schedules.map((programacion) => programacion.jobSchedulesId)).size).toBe(schedules.length)
    for (const programacion of schedules) {
      expect(programacion.startTime).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/)
      expect(jobs.map((trabajo) => trabajo.jobsId)).toContain(programacion.jobsId)
    }
  })

  it('hay un trabajo repetido el mismo día', () => {
    const { schedules } = createSeed(HOY)
    const claves = schedules.map((programacion) => `${programacion.jobsId}|${programacion.date}`)

    expect(new Set(claves).size).toBeLessThan(claves.length)
  })

  it('hay un empleado con dos programaciones el mismo día', () => {
    const { schedules } = createSeed(HOY)
    const cuenta = new Map<string, number>()
    for (const programacion of schedules) {
      for (const id of programacion.employeesIds) {
        const clave = `${id}|${programacion.date}`
        cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1)
      }
    }

    expect(Math.max(0, ...cuenta.values())).toBeGreaterThanOrEqual(2)
  })

  it('tiene al menos una ausencia y todas caen en la semana domingo-sábado de today', () => {
    const { absences } = createSeed(HOY)

    expect(absences.length).toBeGreaterThanOrEqual(1)
    for (const ausencia of absences) {
      expect(ausencia.date >= DESDE && ausencia.date <= HASTA).toBe(true)
    }
  })

  it('las ausencias se mueven con la semana de today', () => {
    const { absences } = createSeed(new Date(2026, 10, 14))

    for (const ausencia of absences) {
      expect(ausencia.date >= '2026-11-08' && ausencia.date <= '2026-11-14').toBe(true)
    }
  })

  it('las ausencias tienen ids distintos, empleados existentes y activos y un absenceType válido', () => {
    const { absences, employees } = createSeed(HOY)

    expect(new Set(absences.map((ausencia) => ausencia.employeeAbsencesId)).size).toBe(absences.length)
    for (const ausencia of absences) {
      const empleado = employees.find((candidato) => candidato.employeesId === ausencia.employeesId)
      expect(empleado?.status).toBe('Active')
      expect(['Off', 'Vacation', 'Sick', 'Other']).toContain(ausencia.absenceType)
    }
  })

  it('las ausencias tienen la forma {employeeAbsencesId, employeesId, date, absenceType, absenceComment}', () => {
    const { absences } = createSeed(HOY)

    for (const ausencia of absences) {
      expect(Object.keys(ausencia).sort()).toEqual(
        ['employeeAbsencesId', 'employeesId', 'date', 'absenceType', 'absenceComment'].sort(),
      )
      expect(ausencia.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('ninguna ausencia coincide con una asignación del mismo empleado el mismo día', () => {
    const { absences, schedules } = createSeed(HOY)

    for (const ausencia of absences) {
      const choques = schedules.filter(
        (programacion) =>
          programacion.date === ausencia.date && programacion.employeesIds.includes(ausencia.employeesId),
      )
      expect(choques).toEqual([])
    }
  })

  it('no hay dos ausencias del mismo empleado el mismo día', () => {
    const { absences } = createSeed(HOY)
    const claves = absences.map((ausencia) => `${ausencia.employeesId}|${ausencia.date}`)

    expect(new Set(claves).size).toBe(claves.length)
  })

  it('los employeesIds de las programaciones existen y no se repiten', () => {
    const { employees, schedules } = createSeed(HOY)
    const ids = new Set(employees.map((empleado) => empleado.employeesId))

    for (const programacion of schedules) {
      expect(new Set(programacion.employeesIds).size).toBe(programacion.employeesIds.length)
      for (const id of programacion.employeesIds) {
        expect(ids.has(id)).toBe(true)
      }
    }
  })
})
