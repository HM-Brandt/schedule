// Tests de la resolución de soltar (tarea 6.1 de `schedule-assign`).
//
// Cubren cada combinación origen-destino de la decisión 5 de `design.md`: qué acción
// produce `resolveDrop` y qué tipos acepta cada destino según `ACCEPTS`.
import { describe, expect, it } from 'vitest'
import { trabajo } from '../test/fabricas'
import type { Absence, Job, Schedule } from '../api/types'
import { absenceLookup } from '../lib/selectors'
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

const MARTES = '2026-11-03'

// Ana (3) está ausente el lunes; Luis (5), el jueves.
const AUSENCIA_ANA: Absence = { employeeAbsencesId: 1, employeesId: 3, date: LUNES, absenceType: 'Vacation', absenceComment: null }
const AUSENCIA_LUIS: Absence = { employeeAbsencesId: 2, employeesId: 5, date: JUEVES, absenceType: 'Sick', absenceComment: 'Gripe' }

const SIN_AUSENCIAS = absenceLookup([])
const CON_AUSENCIAS = absenceLookup([AUSENCIA_ANA, AUSENCIA_LUIS])

// Tarjeta del martes con Carlos Ruiz (8).
const TARJETA_MARTES: Schedule = { jobSchedulesId: 3, job: PINTAR_OFICINA, date: MARTES, startTime: '07:00', employeesIds: [8], scheduleComment: null }

const SIN_ALT = { altKey: false, absences: SIN_AUSENCIAS }
const CON_ALT = { altKey: true, absences: SIN_AUSENCIAS }
const SIN_ALT_CON_AUSENCIAS = { altKey: false, absences: CON_AUSENCIAS }
const CON_ALT_CON_AUSENCIAS = { altKey: true, absences: CON_AUSENCIAS }

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
const zonaAusencias = (date: string): DropData => ({ kind: 'absences', date })
const ausenciaArrastrada = (absence: Absence): DragData => ({
  kind: 'absence',
  employeeAbsencesId: absence.employeeAbsencesId,
  employeeId: absence.employeesId,
  date: absence.date,
})

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
      ['trabajo del catálogo en la zona de ausencias', trabajoDelCatalogo, zonaAusencias(MARTES)],
      ['tarjeta en la zona de ausencias', tarjetaArrastrada(TARJETA_A), zonaAusencias(MARTES)],
    ])('%s: no hace nada', (_caso, origen, destino) => {
      expect(resolveDrop(origen, destino, SIN_ALT)).toEqual({ kind: 'none' })
      expect(resolveDrop(origen, destino, CON_ALT)).toEqual({ kind: 'none' })
    })
  })

  describe('empleado en la zona de ausencias', () => {
    it('del panel, en un día sin ausencia suya: abre el diálogo (mark-absent)', () => {
      expect(resolveDrop(empleadoDelPanel(3), zonaAusencias(MARTES), SIN_ALT_CON_AUSENCIAS)).toEqual({
        kind: 'mark-absent',
        employeeId: 3,
        date: MARTES,
      })
    })

    it('de una tarjeta, en un día sin ausencia suya: abre el diálogo (mark-absent)', () => {
      expect(
        resolveDrop(empleadoDeTarjeta(5, TARJETA_A.jobSchedulesId), zonaAusencias(LUNES), SIN_ALT_CON_AUSENCIAS),
      ).toEqual({ kind: 'mark-absent', employeeId: 5, date: LUNES })
    })

    it('con Alt pulsado también abre el diálogo: Alt no cambia nada', () => {
      expect(resolveDrop(empleadoDelPanel(3), zonaAusencias(MARTES), CON_ALT_CON_AUSENCIAS)).toEqual({
        kind: 'mark-absent',
        employeeId: 3,
        date: MARTES,
      })
    })

    it('un empleado con ausencia en otro día sí puede marcarse en este', () => {
      // Ana está ausente el lunes, no el martes.
      expect(resolveDrop(empleadoDelPanel(3), zonaAusencias(MARTES), SIN_ALT_CON_AUSENCIAS).kind).toBe('mark-absent')
    })

    it('del panel, en un día en que ya está ausente: no hace nada', () => {
      expect(resolveDrop(empleadoDelPanel(3), zonaAusencias(LUNES), SIN_ALT_CON_AUSENCIAS)).toEqual({ kind: 'none' })
    })

    it('de una tarjeta, en un día en que ya está ausente: no hace nada', () => {
      expect(
        resolveDrop(empleadoDeTarjeta(5, TARJETA_A.jobSchedulesId), zonaAusencias(JUEVES), SIN_ALT_CON_AUSENCIAS),
      ).toEqual({ kind: 'none' })
    })
  })

  describe('empleado ausente en una tarjeta de su día', () => {
    it('del panel, en una tarjeta del día en que está ausente: devuelve blocked-assign con la fecha de la tarjeta', () => {
      // Ana está ausente el lunes y la tarjeta B es del lunes.
      expect(resolveDrop(empleadoDelPanel(3), tarjetaDestino(TARJETA_B), SIN_ALT_CON_AUSENCIAS)).toEqual({
        kind: 'blocked-assign',
        employeeId: 3,
        date: LUNES,
      })
    })

    it('de otra tarjeta, en una tarjeta del día en que está ausente: devuelve blocked-assign con la fecha de la tarjeta', () => {
      expect(resolveDrop(empleadoDeTarjeta(3, TARJETA_MARTES.jobSchedulesId), tarjetaDestino(TARJETA_A), SIN_ALT_CON_AUSENCIAS)).toEqual({
        kind: 'blocked-assign',
        employeeId: 3,
        date: LUNES,
      })
    })

    it('en una tarjeta de otro día sí se asigna', () => {
      expect(resolveDrop(empleadoDelPanel(3), tarjetaDestino(TARJETA_MARTES), SIN_ALT_CON_AUSENCIAS)).toEqual({
        kind: 'assign',
        employeeId: 3,
        schedule: TARJETA_MARTES,
      })
    })

    it('otro empleado no ausente en una tarjeta del mismo día sí se asigna', () => {
      expect(resolveDrop(empleadoDelPanel(4), tarjetaDestino(TARJETA_B), SIN_ALT_CON_AUSENCIAS)).toEqual({
        kind: 'assign',
        employeeId: 4,
        schedule: TARJETA_B,
      })
    })
  })

  describe('ausencia arrastrada', () => {
    it('soltada fuera de cualquier destino: la quita (remove-absence)', () => {
      expect(resolveDrop(ausenciaArrastrada(AUSENCIA_ANA), null, SIN_ALT_CON_AUSENCIAS)).toEqual({
        kind: 'remove-absence',
        employeeAbsencesId: AUSENCIA_ANA.employeeAbsencesId,
      })
    })

    it('soltada en su propia zona (desviación decidida): no hace nada', () => {
      expect(resolveDrop(ausenciaArrastrada(AUSENCIA_ANA), zonaAusencias(LUNES), SIN_ALT_CON_AUSENCIAS)).toEqual({ kind: 'none' })
    })

    it.each<[string, DropData]>([
      ['la zona de ausencias de otro día', zonaAusencias(MARTES)],
      ['un día', dia(MARTES)],
      ['una tarjeta', tarjetaDestino(TARJETA_A)],
      ['el catálogo', catalogo],
    ])('soltada en %s: no hace nada', (_destino, destino) => {
      expect(resolveDrop(ausenciaArrastrada(AUSENCIA_ANA), destino, SIN_ALT_CON_AUSENCIAS)).toEqual({ kind: 'none' })
      expect(resolveDrop(ausenciaArrastrada(AUSENCIA_ANA), destino, CON_ALT_CON_AUSENCIAS)).toEqual({ kind: 'none' })
    })
  })

  describe('tarjeta a un día con empleados ausentes', () => {
    it('con un asignado ausente ese día: bloquea el movimiento y lo nombra (blocked-move)', () => {
      // Luis (5) está en la tarjeta A y ausente el jueves.
      expect(resolveDrop(tarjetaArrastrada(TARJETA_A), dia(JUEVES), SIN_ALT_CON_AUSENCIAS)).toEqual({
        kind: 'blocked-move',
        schedule: TARJETA_A,
        date: JUEVES,
        employeeIds: [5],
      })
    })

    it('con varios asignados ausentes: los lista a todos en el orden de la tarjeta', () => {
      const ausentes = absenceLookup([
        { ...AUSENCIA_LUIS, employeeAbsencesId: 3, employeesId: 5, date: MARTES },
        { ...AUSENCIA_ANA, employeeAbsencesId: 4, employeesId: 3, date: MARTES },
      ])

      expect(resolveDrop(tarjetaArrastrada(TARJETA_A), dia(MARTES), { altKey: false, absences: ausentes })).toEqual({
        kind: 'blocked-move',
        schedule: TARJETA_A,
        date: MARTES,
        employeeIds: [3, 5],
      })
    })

    it('si el ausente ese día no está en la tarjeta: la mueve (move)', () => {
      // Ana y Luis están ausentes el lunes y el jueves, pero la tarjeta del martes solo lleva a Carlos (8).
      expect(resolveDrop(tarjetaArrastrada(TARJETA_MARTES), dia(JUEVES), SIN_ALT_CON_AUSENCIAS)).toEqual({
        kind: 'move',
        schedule: TARJETA_MARTES,
        date: JUEVES,
      })
    })

    it('una tarjeta sin empleados se mueve a cualquier día', () => {
      const vacia: Schedule = { ...TARJETA_B, jobSchedulesId: 4, employeesIds: [] }

      expect(resolveDrop(tarjetaArrastrada(vacia), dia(JUEVES), SIN_ALT_CON_AUSENCIAS).kind).toBe('move')
    })

    it('a su mismo día no hace nada, aunque un asignado esté ausente', () => {
      // Ana está ausente el lunes y la tarjeta A es del lunes.
      expect(resolveDrop(tarjetaArrastrada(TARJETA_A), dia(LUNES), SIN_ALT_CON_AUSENCIAS)).toEqual({ kind: 'none' })
    })

    it('sin ausencias en el día de destino: la mueve (move)', () => {
      expect(resolveDrop(tarjetaArrastrada(TARJETA_A), dia(MARTES), SIN_ALT_CON_AUSENCIAS).kind).toBe('move')
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

  it('la zona de ausencias acepta empleados y ausencias (desviación decidida respecto a design.md)', () => {
    expect([...ACCEPTS.absences].sort()).toEqual(['absence', 'employee'])
  })

  it('hay cuatro destinos: día, tarjeta, catálogo y zona de ausencias', () => {
    expect(Object.keys(ACCEPTS).sort()).toEqual(['absences', 'catalog', 'day', 'schedule-card'])
  })
})
