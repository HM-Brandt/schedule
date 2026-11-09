// Tests de los tonos por trabajo y por empleado (tarea 9.6 de `schedule-assign`).
//
// `jobHue` y `employeeHue` asignan a cada id uno de los 8 tonos de la paleta (de 1 a 8), que
// los componentes aplican con `data-hue`. El tono de un id no cambia entre llamadas.
import { describe, expect, it } from 'vitest'
import { employeeHue, jobHue } from './colors'

const IDS_LIMITE = [0, 1, 7, 8, 9, -1, -8, -9, 1_000_003, Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER]

describe.each([
  ['jobHue', jobHue],
  ['employeeHue', employeeHue],
])('%s', (_nombre, tono) => {
  it.each(IDS_LIMITE)('con el id %d devuelve un entero de 1 a 8', (id) => {
    const resultado = tono(id)

    expect(Number.isInteger(resultado)).toBe(true)
    expect(resultado).toBeGreaterThanOrEqual(1)
    expect(resultado).toBeLessThanOrEqual(8)
  })

  it('devuelve un entero de 1 a 8 para todos los ids de -100 a 100', () => {
    for (let id = -100; id <= 100; id++) {
      const resultado = tono(id)
      expect(Number.isInteger(resultado), `id ${id}`).toBe(true)
      expect(resultado, `id ${id}`).toBeGreaterThanOrEqual(1)
      expect(resultado, `id ${id}`).toBeLessThanOrEqual(8)
    }
  })

  it('es estable: el mismo id da siempre el mismo tono', () => {
    for (const id of [...IDS_LIMITE, 3, 42, 1024]) {
      expect(tono(id)).toBe(tono(id))
    }
  })

  it('los ids consecutivos del 1 al 8 recorren los 8 tonos', () => {
    const tonos = [1, 2, 3, 4, 5, 6, 7, 8].map(tono)

    expect(new Set(tonos).size).toBe(8)
    expect([...tonos].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('cualquier tramo de 8 ids consecutivos recorre los 8 tonos', () => {
    for (const inicio of [0, 13, 1000, -20]) {
      const tonos = Array.from({ length: 8 }, (_, i) => tono(inicio + i))
      expect(new Set(tonos).size, `desde ${inicio}`).toBe(8)
    }
  })
})
