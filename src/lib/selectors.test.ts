// Tests de los selectores derivados (tarea 4.4 de `schedule-assign`).
//
// Cubren "Orden de las programaciones dentro del día" e "Indicador de trabajo en uso"
// de `specs/weekly-schedule-board/spec.md`, e "Indicador de carga al arrastrar" de
// `specs/employee-assignment/spec.md`.
import { describe, expect, it } from 'vitest'
import { trabajo } from '../test/fabricas'
import type { Job, Schedule } from '../api/types'
import { getWeekDays } from './dates'
import { compareSchedules, employeeDayCounts, jobWeekCounts, schedulesByDay } from './selectors'

const PINTAR_OFICINA: Job = trabajo(7, 'J-1024', 'Pintar oficina')
const JARDIN_PEREZ: Job = trabajo(14, 'J-1031', 'Jardín Pérez')
const MUDANZA_LOPEZ: Job = trabajo(23, 'J-1040', 'Mudanza López')

/** Semana del domingo 2026-11-01 al sábado 2026-11-07. */
const DIAS = getWeekDays('2026-11-01')
const LUNES = '2026-11-02'
const MARTES = '2026-11-03'
const MIERCOLES = '2026-11-04'

const ANA = 3
const LUIS = 5

function programacion(
  id: number,
  date: string,
  startTime: string,
  job: Job = PINTAR_OFICINA,
  employeesIds: number[] = [],
): Schedule {
  return { jobSchedulesId: id, job, date, startTime, employeesIds, scheduleComment: null }
}

const horas = (programaciones: Schedule[]) => programaciones.map((item) => item.startTime)
const ids = (programaciones: Schedule[]) => programaciones.map((item) => item.jobSchedulesId)

describe('schedulesByDay', () => {
  it('ordena el lunes con 09:00, 07:00 y 08:00 como 07:00, 08:00, 09:00', () => {
    const programaciones = [
      programacion(1, LUNES, '09:00'),
      programacion(2, LUNES, '07:00'),
      programacion(3, LUNES, '08:00'),
    ]

    const porDia = schedulesByDay(programaciones, DIAS)

    expect(horas(porDia[LUNES])).toEqual(['07:00', '08:00', '09:00'])
  })

  it('a igual hora ordena por id ascendente y deja los ids temporales negativos al final', () => {
    const programaciones = [
      programacion(-2, LUNES, '07:00'),
      programacion(5, LUNES, '07:00'),
      programacion(-1, LUNES, '07:00'),
      programacion(2, LUNES, '07:00'),
    ]

    const porDia = schedulesByDay(programaciones, DIAS)

    expect(ids(porDia[LUNES])).toEqual([2, 5, -1, -2])
  })

  it('una programación temporal con hora anterior va antes que una real más tarde', () => {
    const programaciones = [programacion(1, LUNES, '08:00'), programacion(-1, LUNES, '07:00')]

    expect(ids(schedulesByDay(programaciones, DIAS)[LUNES])).toEqual([-1, 1])
  })

  it('incluye los 7 días aunque estén vacíos', () => {
    const porDia = schedulesByDay([programacion(1, LUNES, '07:00')], DIAS)

    expect(Object.keys(porDia)).toEqual(DIAS)
    expect(porDia['2026-11-01']).toEqual([])
    expect(porDia[MARTES]).toEqual([])
    expect(porDia['2026-11-07']).toEqual([])
    expect(ids(porDia[LUNES])).toEqual([1])
  })

  it('reparte cada programación en su día e ignora las de fuera de la semana', () => {
    const programaciones = [
      programacion(1, LUNES, '07:00'),
      programacion(2, MIERCOLES, '07:00'),
      programacion(3, '2026-11-09', '07:00'),
    ]

    const porDia = schedulesByDay(programaciones, DIAS)

    expect(ids(porDia[LUNES])).toEqual([1])
    expect(ids(porDia[MIERCOLES])).toEqual([2])
    expect(Object.values(porDia).flat()).toHaveLength(2)
  })

  it('no modifica la lista recibida', () => {
    const programaciones = [programacion(1, LUNES, '09:00'), programacion(2, LUNES, '07:00')]

    schedulesByDay(programaciones, DIAS)

    expect(ids(programaciones)).toEqual([1, 2])
  })
})

describe('compareSchedules', () => {
  it('ordena primero por hora de inicio', () => {
    expect(compareSchedules(programacion(9, LUNES, '07:00'), programacion(1, LUNES, '08:00'))).toBeLessThan(0)
    expect(compareSchedules(programacion(1, LUNES, '08:00'), programacion(9, LUNES, '07:00'))).toBeGreaterThan(0)
  })

  it('a igual hora, la real va antes que la temporal', () => {
    expect(compareSchedules(programacion(-1, LUNES, '07:00'), programacion(100, LUNES, '07:00'))).toBeGreaterThan(0)
  })
})

describe('jobWeekCounts', () => {
  it('un trabajo programado el lunes y el miércoles cuenta 2', () => {
    const programaciones = [
      programacion(1, LUNES, '07:00', PINTAR_OFICINA),
      programacion(2, MIERCOLES, '07:00', PINTAR_OFICINA),
      programacion(3, MARTES, '07:00', JARDIN_PEREZ),
    ]

    const contadores = jobWeekCounts(programaciones)

    expect(contadores.get(PINTAR_OFICINA.jobsId)).toBe(2)
    expect(contadores.get(JARDIN_PEREZ.jobsId)).toBe(1)
  })

  it('un trabajo sin programar no aparece', () => {
    const contadores = jobWeekCounts([programacion(1, LUNES, '07:00', PINTAR_OFICINA)])

    expect(contadores.has(MUDANZA_LOPEZ.jobsId)).toBe(false)
  })

  it('sin programaciones devuelve un mapa vacío', () => {
    expect(jobWeekCounts([]).size).toBe(0)
  })
})

describe('employeeDayCounts', () => {
  it('Ana con dos programaciones el lunes cuenta 2 el lunes y no tiene entrada el martes', () => {
    const programaciones = [
      programacion(1, LUNES, '07:00', PINTAR_OFICINA, [ANA, LUIS]),
      programacion(2, LUNES, '08:00', JARDIN_PEREZ, [ANA]),
    ]

    const contadores = employeeDayCounts(programaciones)

    expect(contadores.get(ANA)?.get(LUNES)).toBe(2)
    expect(contadores.get(ANA)?.has(MARTES)).toBe(false)
    expect(contadores.get(LUIS)?.get(LUNES)).toBe(1)
  })

  it('cuenta por separado cada día del empleado', () => {
    const programaciones = [
      programacion(1, LUNES, '07:00', PINTAR_OFICINA, [ANA]),
      programacion(2, MIERCOLES, '07:00', PINTAR_OFICINA, [ANA]),
    ]

    const contadores = employeeDayCounts(programaciones)

    expect(contadores.get(ANA)?.get(LUNES)).toBe(1)
    expect(contadores.get(ANA)?.get(MIERCOLES)).toBe(1)
  })

  it('un empleado sin programaciones no aparece', () => {
    const contadores = employeeDayCounts([programacion(1, LUNES, '07:00', PINTAR_OFICINA, [LUIS])])

    expect(contadores.has(ANA)).toBe(false)
  })
})
