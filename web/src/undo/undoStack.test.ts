// Tests de la pila de deshacer (tarea 8.2 de `schedule-assign`): `pushEntry` y
// `replaceScheduleId` de `undoStack.ts`.
//
// Cubren la decisión 6 de `design.md`: cada fila de la tabla de inversas se guarda como una
// sola entrada, la pila admite como máximo 20 entradas (se descarta la más antigua) y, al
// deshacer un "quitar", el id viejo se reemplaza por el nuevo en las entradas que lo usan.
// Las inversas que produce cada acción real se comprueban en `useScheduleActions.test.tsx`.
import { describe, expect, it } from 'vitest'
import type { Job } from '../api/types'
import { pushEntry, replaceScheduleId } from './undoStack'
import type { InverseOp, UndoEntry } from './undoStack'

const PINTAR: Job = { id: 7, number: 'J-1024', name: 'Pintar oficina' }
const LUNES = '2026-11-02'

/** Inversas de cada fila de la tabla de la decisión 6 para la programación 1. */
const INVERSAS: Record<string, InverseOp[]> = {
  'Programar (POST): DELETE de la nueva programación': [{ kind: 'delete', id: 1 }],
  'Mover o cambiar la hora (PATCH): PATCH con la fecha y la hora anteriores': [
    { kind: 'patch', id: 1, changes: { date: LUNES, start_time: '07:00' } },
  ],
  'Duplicar (POST): DELETE de la copia': [{ kind: 'delete', id: 1 }],
  'Quitar (DELETE): POST con el mismo trabajo, fecha, hora y empleados': [
    { kind: 'create', job: PINTAR, date: LUNES, start_time: '07:00', employee_ids: [3, 5], replacesId: 1 },
  ],
  'Cambiar empleados (PUT): PUT con el conjunto anterior': [{ kind: 'put', id: 1, employee_ids: [3, 5] }],
  'Mover un empleado (2 PUT): 2 PUT con los conjuntos anteriores en una sola entrada': [
    { kind: 'put', id: 1, employee_ids: [3, 5] },
    { kind: 'put', id: 3, employee_ids: [8] },
  ],
}

const entrada = (label: string, ops: InverseOp[] = [{ kind: 'delete', id: 1 }]): UndoEntry => ({ label, ops })

describe('pushEntry', () => {
  describe('una fila de la tabla de inversas se apila como una sola entrada', () => {
    it.each(Object.entries(INVERSAS))('%s', (_fila, ops) => {
      const pila = pushEntry([], entrada('Acción', ops))

      expect(pila).toEqual([{ label: 'Acción', ops }])
    })
  })

  it('añade la nueva entrada al final, encima de las anteriores', () => {
    const pila = pushEntry([entrada('Primera'), entrada('Segunda')], entrada('Tercera'))

    expect(pila.map((item) => item.label)).toEqual(['Primera', 'Segunda', 'Tercera'])
  })

  it('no modifica la pila que recibe', () => {
    const anterior = [entrada('Primera')]

    pushEntry(anterior, entrada('Segunda'))

    expect(anterior).toEqual([entrada('Primera')])
  })

  it('con 19 entradas, la vigésima entra sin descartar ninguna', () => {
    let pila: UndoEntry[] = []
    for (let numero = 1; numero <= 19; numero++) pila = pushEntry(pila, entrada(`Acción ${numero}`))

    pila = pushEntry(pila, entrada('Acción 20'))

    expect(pila).toHaveLength(20)
    expect(pila[0].label).toBe('Acción 1')
    expect(pila[19].label).toBe('Acción 20')
  })

  it('con 20 entradas, la vigesimoprimera descarta la más antigua', () => {
    let pila: UndoEntry[] = []
    for (let numero = 1; numero <= 20; numero++) pila = pushEntry(pila, entrada(`Acción ${numero}`))

    pila = pushEntry(pila, entrada('Acción 21'))

    expect(pila).toHaveLength(20)
    expect(pila[0].label).toBe('Acción 2')
    expect(pila[19].label).toBe('Acción 21')
  })

  it('tras 25 acciones solo conserva las 20 últimas, en orden', () => {
    let pila: UndoEntry[] = []
    for (let numero = 1; numero <= 25; numero++) pila = pushEntry(pila, entrada(`Acción ${numero}`))

    expect(pila.map((item) => item.label)).toEqual(
      Array.from({ length: 20 }, (_, indice) => `Acción ${indice + 6}`),
    )
  })
})

describe('replaceScheduleId', () => {
  it('cambia el id viejo por el nuevo en las inversas DELETE, PATCH y PUT', () => {
    const pila: UndoEntry[] = [
      entrada('Programar', [{ kind: 'delete', id: 1 }]),
      entrada('Mover', [{ kind: 'patch', id: 1, changes: { date: LUNES, start_time: '07:00' } }]),
      entrada('Empleados', [{ kind: 'put', id: 1, employee_ids: [3] }]),
    ]

    expect(replaceScheduleId(pila, 1, 9)).toEqual([
      entrada('Programar', [{ kind: 'delete', id: 9 }]),
      entrada('Mover', [{ kind: 'patch', id: 9, changes: { date: LUNES, start_time: '07:00' } }]),
      entrada('Empleados', [{ kind: 'put', id: 9, employee_ids: [3] }]),
    ])
  })

  it('en una entrada de dos PUT solo cambia el que usa el id viejo', () => {
    const pila = [entrada('Mover empleado', INVERSAS[Object.keys(INVERSAS)[5]])]

    expect(replaceScheduleId(pila, 3, 9)).toEqual([
      entrada('Mover empleado', [
        { kind: 'put', id: 1, employee_ids: [3, 5] },
        { kind: 'put', id: 9, employee_ids: [8] },
      ]),
    ])
  })

  it('no toca las inversas de otras programaciones', () => {
    const pila = [
      entrada('Otra', [{ kind: 'delete', id: 2 }]),
      entrada('Otra hora', [{ kind: 'patch', id: 4, changes: { start_time: '09:30' } }]),
    ]

    expect(replaceScheduleId(pila, 1, 9)).toEqual(pila)
  })

  it('no cambia una inversa POST, que no tiene id de programación', () => {
    const quitar: InverseOp = {
      kind: 'create',
      job: PINTAR,
      date: LUNES,
      start_time: '07:00',
      employee_ids: [3],
      replacesId: 1,
    }

    expect(replaceScheduleId([entrada('Quitar', [quitar])], 1, 9)).toEqual([entrada('Quitar', [quitar])])
  })

  it('conserva el orden y el número de entradas y no modifica la pila que recibe', () => {
    const pila = [entrada('A', [{ kind: 'delete', id: 1 }]), entrada('B', [{ kind: 'delete', id: 2 }])]
    const copia = structuredClone(pila)

    const nueva = replaceScheduleId(pila, 1, 9)

    expect(nueva.map((item) => item.label)).toEqual(['A', 'B'])
    expect(pila).toEqual(copia)
  })

  it('con la pila vacía devuelve una pila vacía', () => {
    expect(replaceScheduleId([], 1, 9)).toEqual([])
  })
})
