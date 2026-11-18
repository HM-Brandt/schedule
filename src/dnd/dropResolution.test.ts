// Tests de la resolución de soltar (tarea 6.1 de `schedule-assign`).
//
// Cubren cada combinación origen-destino de la decisión 5 de `design.md`: qué acción
// produce `resolveDrop` y qué tipos acepta cada destino según `ACCEPTS`.
import { describe, expect, it } from 'vitest'
import { trabajo } from '../test/fabricas'
import type { Job, Schedule } from '../api/types'
import { ACCEPTS, resolveDrop } from './dropResolution'
import type { DragData, DropData } from './dropResolution'

const JARDIN_PEREZ: Job = trabajo(14, 'J-1031', 'Jardín Pérez')
const PINTAR_OFICINA: Job = trabajo(7, 'J-1024', 'Pintar oficina')

const LUNES = '2026-11-02'
const JUEVES = '2026-11-05'

// Tarjeta A: lunes, con Ana López (3) y Luis Martínez (5).
const TARJETA_A: Schedule = { jobSchedulesId: 1, job: PINTAR_OFICINA, date: LUNES, startTime: '07:00', employeesIds: [3, 5], scheduleComment: null }
// Tarjeta B: lunes, solo con Ana López (3).
const TARJETA_B: Schedule = { jobSchedulesId: 2, job: PINTAR_OFICINA, date: LUNES, startTime: '08:00', employeesIds: [3], scheduleComment: null }

const SIN_ALT = { altKey: false }
const CON_ALT = { altKey: true }

const trabajoDelCatalogo: DragData = { kind: 'catalog-job', job: JARDIN_PEREZ }
const tarjetaArrastrada = (schedule: Schedule): DragData => ({ kind: 'schedule-card', schedule })
const empleadoDelPanel = (employeeId: number): DragData => ({ kind: 'employee', employeeId })
const empleadoDeTarjeta = (employeeId: number, fromScheduleId: number): DragData => ({
  kind: 'employee',
  employeeId,
  fromScheduleId,
})

const dia = (date: string): DropData => ({ kind: 'day', date })
const tarjetaDestino = (schedule: Schedule): DropData => ({ kind: 'schedule-card', schedule })
const catalogo: DropData = { kind: 'catalog' }

describe('resolveDrop', () => {
  describe('trabajo del catálogo', () => {
    it('soltado en un día: crea una programación con ese trabajo en ese día', () => {
      expect(resolveDrop(trabajoDelCatalogo, dia(JUEVES), SIN_ALT)).toEqual({
        kind: 'create',
        job: JARDIN_PEREZ,
        date: JUEVES,
      })
    })

    it('soltado en un día con Alt: también crea, Alt no cambia nada', () => {
      expect(resolveDrop(trabajoDelCatalogo, dia(JUEVES), CON_ALT)).toEqual({
        kind: 'create',
        job: JARDIN_PEREZ,
        date: JUEVES,
      })
    })
  })

  describe('tarjeta de programación', () => {
    it('soltada en otro día sin Alt: mueve la programación a ese día', () => {
      expect(resolveDrop(tarjetaArrastrada(TARJETA_A), dia(JUEVES), SIN_ALT)).toEqual({
        kind: 'move',
        schedule: TARJETA_A,
        date: JUEVES,
      })
    })

    it('soltada en su mismo día sin Alt: no hace nada', () => {
      expect(resolveDrop(tarjetaArrastrada(TARJETA_A), dia(LUNES), SIN_ALT)).toEqual({ kind: 'none' })
    })

    it('soltada en otro día con Alt: duplica la programación en ese día', () => {
      expect(resolveDrop(tarjetaArrastrada(TARJETA_A), dia(JUEVES), CON_ALT)).toEqual({
        kind: 'duplicate',
        schedule: TARJETA_A,
        date: JUEVES,
      })
    })

    it('soltada en su mismo día con Alt: duplica la programación en ese mismo día', () => {
      expect(resolveDrop(tarjetaArrastrada(TARJETA_A), dia(LUNES), CON_ALT)).toEqual({
        kind: 'duplicate',
        schedule: TARJETA_A,
        date: LUNES,
      })
    })

    it('soltada en el catálogo: quita la programación', () => {
      expect(resolveDrop(tarjetaArrastrada(TARJETA_A), catalogo, SIN_ALT)).toEqual({
        kind: 'remove',
        schedule: TARJETA_A,
      })
    })
  })

  describe('empleado del panel', () => {
    it('soltado en una tarjeta donde no está: lo asigna a esa tarjeta', () => {
      // Pedro Sánchez (4) no está en la tarjeta A.
      expect(resolveDrop(empleadoDelPanel(4), tarjetaDestino(TARJETA_A), SIN_ALT)).toEqual({
        kind: 'assign',
        employeeId: 4,
        schedule: TARJETA_A,
      })
    })

    it('soltado en una tarjeta donde ya está asignado: no hace nada', () => {
      expect(resolveDrop(empleadoDelPanel(3), tarjetaDestino(TARJETA_A), SIN_ALT)).toEqual({ kind: 'none' })
    })

    it('soltado fuera de cualquier destino: no hace nada', () => {
      expect(resolveDrop(empleadoDelPanel(4), null, SIN_ALT)).toEqual({ kind: 'none' })
    })
  })

  describe('empleado de una tarjeta', () => {
    it('soltado en otra tarjeta donde no está: lo pasa de la tarjeta A a la B', () => {
      // Luis Martínez (5) está en A y no en B.
      expect(resolveDrop(empleadoDeTarjeta(5, TARJETA_A.jobSchedulesId), tarjetaDestino(TARJETA_B), SIN_ALT)).toEqual({
        kind: 'transfer',
        employeeId: 5,
        fromScheduleId: TARJETA_A.jobSchedulesId,
        schedule: TARJETA_B,
      })
    })

    it('soltado en su misma tarjeta: no hace nada', () => {
      expect(resolveDrop(empleadoDeTarjeta(5, TARJETA_A.jobSchedulesId), tarjetaDestino(TARJETA_A), SIN_ALT)).toEqual({
        kind: 'none',
      })
    })

    it('soltado en otra tarjeta donde ya está: solo lo retira de la tarjeta A', () => {
      // Ana López (3) está en A y en B.
      expect(resolveDrop(empleadoDeTarjeta(3, TARJETA_A.jobSchedulesId), tarjetaDestino(TARJETA_B), SIN_ALT)).toEqual({
        kind: 'unassign',
        employeeId: 3,
        fromScheduleId: TARJETA_A.jobSchedulesId,
      })
    })

    it('soltado fuera de cualquier destino: lo retira de su tarjeta', () => {
      expect(resolveDrop(empleadoDeTarjeta(5, TARJETA_A.jobSchedulesId), null, SIN_ALT)).toEqual({
        kind: 'unassign',
        employeeId: 5,
        fromScheduleId: TARJETA_A.jobSchedulesId,
      })
    })
  })

  describe('combinaciones no aceptadas', () => {
    it.each<[string, DragData, DropData | null]>([
      ['trabajo del catálogo en el catálogo', trabajoDelCatalogo, catalogo],
      ['trabajo del catálogo en una tarjeta', trabajoDelCatalogo, tarjetaDestino(TARJETA_A)],
      ['trabajo del catálogo fuera de cualquier destino', trabajoDelCatalogo, null],
      ['tarjeta en otra tarjeta', tarjetaArrastrada(TARJETA_A), tarjetaDestino(TARJETA_B)],
      ['tarjeta fuera de cualquier destino', tarjetaArrastrada(TARJETA_A), null],
      ['empleado del panel en un día', empleadoDelPanel(4), dia(JUEVES)],
      ['empleado de una tarjeta en un día', empleadoDeTarjeta(5, TARJETA_A.jobSchedulesId), dia(JUEVES)],
      ['empleado del panel en el catálogo', empleadoDelPanel(4), catalogo],
      ['empleado de una tarjeta en el catálogo', empleadoDeTarjeta(5, TARJETA_A.jobSchedulesId), catalogo],
    ])('%s: no hace nada', (_caso, origen, destino) => {
      expect(resolveDrop(origen, destino, SIN_ALT)).toEqual({ kind: 'none' })
      expect(resolveDrop(origen, destino, CON_ALT)).toEqual({ kind: 'none' })
    })
  })
})

describe('ACCEPTS', () => {
  it('un día acepta trabajos del catálogo y tarjetas', () => {
    expect([...ACCEPTS.day].sort()).toEqual(['catalog-job', 'schedule-card'])
  })

  it('una tarjeta acepta solo empleados', () => {
    expect(ACCEPTS['schedule-card']).toEqual(['employee'])
  })

  it('el catálogo acepta solo tarjetas', () => {
    expect(ACCEPTS.catalog).toEqual(['schedule-card'])
  })

  it('no hay más destinos que día, tarjeta y catálogo', () => {
    expect(Object.keys(ACCEPTS).sort()).toEqual(['catalog', 'day', 'schedule-card'])
  })
})
