// Tests de la hora de inicio por defecto (tarea 4.3 de `schedule-assign`).
//
// Cubren los escenarios de "Hora de inicio por defecto" y "Mover una programación a
// otro día" de `specs/weekly-schedule-board/spec.md` y la regla de la decisión 3 de
// `design.md`.
import { describe, expect, it } from 'vitest'
import type { Job, Schedule } from '../api/types'
import { defaultStartTime, startTimeForMove } from './startTime'

const PINTAR_OFICINA: Job = { id: 7, number: 'J-1024', name: 'Pintar oficina' }
const JARDIN_PEREZ: Job = { id: 14, number: 'J-1031', name: 'Jardín Pérez' }

const LUNES = '2026-11-02'
const MARTES = '2026-11-03'

let siguienteId = 1

/** Crea una programación con id único. */
function programacion(job: Job, date: string, start_time: string, employee_ids: number[] = []): Schedule {
  return { id: siguienteId++, job, date, start_time, employee_ids }
}

describe('defaultStartTime', () => {
  it('lunes vacío: el primer trabajo del día queda a las 07:00', () => {
    expect(defaultStartTime([], PINTAR_OFICINA.id, LUNES)).toBe('07:00')
  })

  it('otro trabajo a las 07:00 no influye: el nuevo trabajo queda a las 07:00', () => {
    const programaciones = [programacion(PINTAR_OFICINA, LUNES, '07:00')]

    expect(defaultStartTime(programaciones, JARDIN_PEREZ.id, LUNES)).toBe('07:00')
  })

  it('segunda vez del mismo trabajo con uno a las 07:00: queda a las 08:00', () => {
    const programaciones = [programacion(PINTAR_OFICINA, LUNES, '07:00')]

    expect(defaultStartTime(programaciones, PINTAR_OFICINA.id, LUNES)).toBe('08:00')
  })

  it('hueco por una programación borrada: solo queda la de 08:00 y la nueva queda a las 09:00', () => {
    const programaciones = [programacion(PINTAR_OFICINA, LUNES, '08:00')]

    expect(defaultStartTime(programaciones, PINTAR_OFICINA.id, LUNES)).toBe('09:00')
  })

  it('tope de las 23:00: si ya hay una a las 23:00 la nueva queda a las 23:00', () => {
    const programaciones = [programacion(PINTAR_OFICINA, LUNES, '23:00')]

    expect(defaultStartTime(programaciones, PINTAR_OFICINA.id, LUNES)).toBe('23:00')
  })

  it('usa la hora entera de la más tardía: 09:30 da 10:00', () => {
    const programaciones = [programacion(PINTAR_OFICINA, LUNES, '09:30')]

    expect(defaultStartTime(programaciones, PINTAR_OFICINA.id, LUNES)).toBe('10:00')
  })

  it('toma la hora más alta aunque no sea la última de la lista', () => {
    const programaciones = [
      programacion(PINTAR_OFICINA, LUNES, '10:00'),
      programacion(PINTAR_OFICINA, LUNES, '07:00'),
    ]

    expect(defaultStartTime(programaciones, PINTAR_OFICINA.id, LUNES)).toBe('11:00')
  })

  it('las programaciones del mismo trabajo en otro día no influyen', () => {
    const programaciones = [programacion(PINTAR_OFICINA, MARTES, '07:00')]

    expect(defaultStartTime(programaciones, PINTAR_OFICINA.id, LUNES)).toBe('07:00')
  })

  it('excludeId excluye la propia programación del cálculo', () => {
    const propia = programacion(PINTAR_OFICINA, LUNES, '10:00')
    const otra = programacion(PINTAR_OFICINA, LUNES, '07:00')

    expect(defaultStartTime([propia, otra], PINTAR_OFICINA.id, LUNES, propia.id)).toBe('08:00')
    expect(defaultStartTime([propia], PINTAR_OFICINA.id, LUNES, propia.id)).toBe('07:00')
  })
})

describe('startTimeForMove', () => {
  it('mover a un día sin ese trabajo conserva la hora 07:00', () => {
    const movida = programacion(PINTAR_OFICINA, LUNES, '07:00', [3, 5])

    expect(startTimeForMove([movida], movida, MARTES)).toBe('07:00')
  })

  it('mover a un día que ya tiene ese trabajo a las 07:00 da 08:00', () => {
    const movida = programacion(PINTAR_OFICINA, LUNES, '07:00')
    const enDestino = programacion(PINTAR_OFICINA, MARTES, '07:00')

    expect(startTimeForMove([movida, enDestino], movida, MARTES)).toBe('08:00')
  })

  it('conserva una hora que no es en punto si el destino no tiene ese trabajo', () => {
    const movida = programacion(PINTAR_OFICINA, LUNES, '10:30')

    expect(startTimeForMove([movida], movida, MARTES)).toBe('10:30')
  })

  it('otro trabajo en el día de destino no obliga a recalcular la hora', () => {
    const movida = programacion(PINTAR_OFICINA, LUNES, '07:00')
    const otroTrabajo = programacion(JARDIN_PEREZ, MARTES, '07:00')

    expect(startTimeForMove([movida, otroTrabajo], movida, MARTES)).toBe('07:00')
  })

  it('al recalcular no cuenta la hora de la propia programación movida', () => {
    const movida = programacion(PINTAR_OFICINA, LUNES, '15:00')
    const enDestino = programacion(PINTAR_OFICINA, MARTES, '07:00')

    expect(startTimeForMove([movida, enDestino], movida, MARTES)).toBe('08:00')
  })
})
