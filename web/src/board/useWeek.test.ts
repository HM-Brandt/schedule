// Tests del hook de la semana visible (tarea 5.1 de `schedule-assign`).
//
// La fecha del sistema se fija en el martes 2026-11-03 a las 10:00 hora local. Solo se
// simula `Date`: los temporizadores siguen siendo reales para no interferir con React.
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWeek } from './useWeek'

const DIAS_1_AL_7 = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 3, 10, 0))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useWeek', () => {
  it('al montar da la semana del domingo 1 al sábado 7 y hoy martes 3', () => {
    const { result } = renderHook(() => useWeek())

    expect(result.current.from).toBe('2026-11-01')
    expect(result.current.to).toBe('2026-11-07')
    expect(result.current.days).toEqual(DIAS_1_AL_7)
    expect(result.current.today).toBe('2026-11-03')
  })

  it('goNext pasa a la semana del 8 al 14 y conserva hoy', () => {
    const { result } = renderHook(() => useWeek())

    act(() => result.current.goNext())

    expect(result.current.from).toBe('2026-11-08')
    expect(result.current.to).toBe('2026-11-14')
    expect(result.current.days).toEqual([
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
    ])
    expect(result.current.today).toBe('2026-11-03')
  })

  it('goPrevious pasa a la semana del 25 al 31 de octubre', () => {
    const { result } = renderHook(() => useWeek())

    act(() => result.current.goPrevious())

    expect(result.current.from).toBe('2026-10-25')
    expect(result.current.to).toBe('2026-10-31')
    expect(result.current.days).toHaveLength(7)
    expect(result.current.today).toBe('2026-11-03')
  })

  it('acciones seguidas se acumulan: dos veces goNext y una goPrevious dejan la semana del 8', () => {
    const { result } = renderHook(() => useWeek())

    act(() => result.current.goNext())
    act(() => result.current.goNext())
    act(() => result.current.goPrevious())

    expect(result.current.from).toBe('2026-11-08')
  })

  it('goToday vuelve a la semana actual desde otra semana', () => {
    const { result } = renderHook(() => useWeek())
    act(() => result.current.goNext())
    act(() => result.current.goNext())

    act(() => result.current.goToday())

    expect(result.current.from).toBe('2026-11-01')
    expect(result.current.to).toBe('2026-11-07')
    expect(result.current.days).toEqual(DIAS_1_AL_7)
  })

  it('goToday en la semana actual la deja igual', () => {
    const { result } = renderHook(() => useWeek())

    act(() => result.current.goToday())

    expect(result.current.from).toBe('2026-11-01')
  })

  it('cruza de año: desde el 2026-12-31 goNext pasa a la semana del 2027-01-03', () => {
    vi.setSystemTime(new Date(2026, 11, 31, 10, 0))
    const { result } = renderHook(() => useWeek())

    expect(result.current.from).toBe('2026-12-27')
    expect(result.current.to).toBe('2027-01-02')

    act(() => result.current.goNext())

    expect(result.current.from).toBe('2027-01-03')
    expect(result.current.to).toBe('2027-01-09')
  })

  it('al abrir el domingo 2026-11-01 a las 00:00 la semana empieza ese mismo día', () => {
    vi.setSystemTime(new Date(2026, 10, 1, 0, 0))
    const { result } = renderHook(() => useWeek())

    expect(result.current.from).toBe('2026-11-01')
    expect(result.current.today).toBe('2026-11-01')
  })

  it('al abrir el sábado 2026-11-07 a las 23:59 sigue en la semana del 1 al 7', () => {
    vi.setSystemTime(new Date(2026, 10, 7, 23, 59))
    const { result } = renderHook(() => useWeek())

    expect(result.current.from).toBe('2026-11-01')
    expect(result.current.today).toBe('2026-11-07')
  })
})
