// Tests de `useLayout` (tarea 9.1 de `schedule-assign`).
//
// Cubren el requisito "Diseño responsivo por tamaño de pantalla" de
// `specs/weekly-schedule-board/spec.md` y la decisión 8 de `design.md`: con 1024 px o más,
// escritorio; de 640 a 1023 px, tablet; por debajo de 640 px, teléfono. El ancho de la ventana
// se simula con `simularAncho` (ver `src/test/viewport.ts`).
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { simularAncho } from '../test/viewport'
import { useLayout } from './useLayout'

function disposicionCon(ancho: number) {
  simularAncho(ancho)
  return renderHook(() => useLayout()).result.current
}

describe('useLayout', () => {
  it('sin simular ningún ancho (1280 px por defecto en los tests) devuelve "desktop"', () => {
    expect(renderHook(() => useLayout()).result.current).toBe('desktop')
  })

  describe('anchos de los escenarios del spec', () => {
    it('escenario "Escritorio": a 1280 px devuelve "desktop"', () => {
      expect(disposicionCon(1280)).toBe('desktop')
    })

    it('escenario "Tablet vertical": a 800 px devuelve "tablet"', () => {
      expect(disposicionCon(800)).toBe('tablet')
    })

    it('escenario "Teléfono": a 390 px devuelve "phone"', () => {
      expect(disposicionCon(390)).toBe('phone')
    })
  })

  describe('bordes de los cortes en 1024 y 640 px', () => {
    it('a 1024 px justos devuelve "desktop"', () => {
      expect(disposicionCon(1024)).toBe('desktop')
    })

    it('a 1023 px devuelve "tablet"', () => {
      expect(disposicionCon(1023)).toBe('tablet')
    })

    it('a 640 px justos devuelve "tablet"', () => {
      expect(disposicionCon(640)).toBe('tablet')
    })

    it('a 639 px devuelve "phone"', () => {
      expect(disposicionCon(639)).toBe('phone')
    })
  })

  describe('cambios de ancho con la página abierta', () => {
    it('pasa de "desktop" a "tablet" y a "phone" al estrechar la ventana, y vuelve a "desktop" al ensancharla', () => {
      simularAncho(1280)
      const { result } = renderHook(() => useLayout())
      expect(result.current).toBe('desktop')

      act(() => simularAncho(800))
      expect(result.current).toBe('tablet')

      act(() => simularAncho(390))
      expect(result.current).toBe('phone')

      act(() => simularAncho(1280))
      expect(result.current).toBe('desktop')
    })

    it('un cambio de ancho dentro de la misma disposición la mantiene: de 800 a 700 px sigue en "tablet"', () => {
      simularAncho(800)
      const { result } = renderHook(() => useLayout())

      act(() => simularAncho(700))

      expect(result.current).toBe('tablet')
    })
  })
})
