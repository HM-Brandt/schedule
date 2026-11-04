// Tests de las utilidades de fecha y hora (tarea 2.2 de `schedule-assign`).
//
// Los resultados no deben depender de la zona horaria del proceso. Además de la zona
// por defecto, este archivo se ejecuta con `npm run test:tz`, que lo lanza con
// `TZ=Pacific/Honolulu` (UTC−10) y con `TZ=Pacific/Kiritimati` (UTC+14). La zona
// efectiva aparece en el nombre del primer `describe` para verla en la salida.
import { describe, expect, it } from 'vitest'
import { formatWeekRange, getWeekRange, normalizeTime, parseIsoDate, toIsoDate } from './dates'

const ZONA = Intl.DateTimeFormat().resolvedOptions().timeZone

/** Semana del martes 2026-11-03: de domingo 1 a sábado 7 de noviembre. */
const SEMANA_NOVIEMBRE = { from: '2026-11-01', to: '2026-11-07' }

describe(`utilidades de fecha (zona horaria del proceso: ${ZONA})`, () => {
  describe('getWeekRange', () => {
    it('da del domingo 1 al sábado 7 para el martes 2026-11-03 como IsoDate', () => {
      expect(getWeekRange('2026-11-03')).toEqual(SEMANA_NOVIEMBRE)
    })

    it('da del domingo 1 al sábado 7 para el martes 2026-11-03 como Date local', () => {
      expect(getWeekRange(new Date(2026, 10, 3))).toEqual(SEMANA_NOVIEMBRE)
    })

    it.each([
      ['el domingo 1 como IsoDate', '2026-11-01'],
      ['el sábado 7 como IsoDate', '2026-11-07'],
    ])('da el mismo rango para %s', (_descripcion, fecha) => {
      expect(getWeekRange(fecha)).toEqual(SEMANA_NOVIEMBRE)
    })

    it.each([
      ['el domingo 1 a las 00:00', new Date(2026, 10, 1, 0, 0, 0, 0)],
      ['el sábado 7 a las 23:59:59.999', new Date(2026, 10, 7, 23, 59, 59, 999)],
      ['el martes 3 a las 23:30', new Date(2026, 10, 3, 23, 30)],
    ])('da el mismo rango para %s hora local', (_descripcion, fecha) => {
      expect(getWeekRange(fecha)).toEqual(SEMANA_NOVIEMBRE)
    })

    it('cruza de año: el 2026-12-31 da del 2026-12-27 al 2027-01-02', () => {
      const esperado = { from: '2026-12-27', to: '2027-01-02' }

      expect(getWeekRange('2026-12-31')).toEqual(esperado)
      expect(getWeekRange(new Date(2026, 11, 31))).toEqual(esperado)
    })

    it('la semana siguiente empieza el domingo 8', () => {
      expect(getWeekRange('2026-11-08')).toEqual({ from: '2026-11-08', to: '2026-11-14' })
    })
  })

  describe('toIsoDate', () => {
    it('da la fecha local, no la de UTC', () => {
      expect(toIsoDate(new Date(2026, 10, 1, 0, 0))).toBe('2026-11-01')
      expect(toIsoDate(new Date(2026, 10, 7, 23, 59, 59, 999))).toBe('2026-11-07')
    })

    it('rellena con ceros el mes y el día', () => {
      expect(toIsoDate(new Date(2027, 0, 2))).toBe('2027-01-02')
    })
  })

  describe('parseIsoDate', () => {
    it('devuelve la medianoche local del día indicado', () => {
      const fecha = parseIsoDate('2026-11-03')

      expect(fecha.getFullYear()).toBe(2026)
      expect(fecha.getMonth()).toBe(10)
      expect(fecha.getDate()).toBe(3)
      expect(fecha.getDay()).toBe(2) // martes
      expect(fecha.getHours()).toBe(0)
      expect(fecha.getMinutes()).toBe(0)
      expect(fecha.getSeconds()).toBe(0)
      expect(fecha.getMilliseconds()).toBe(0)
    })

    it.each(['2026-11-01', '2026-11-03', '2026-11-07', '2026-12-31', '2027-01-02', '2028-02-29'])(
      'ida y vuelta con toIsoDate: %s',
      (iso) => {
        expect(toIsoDate(parseIsoDate(iso))).toBe(iso)
      },
    )

    it('ida y vuelta desde un Date local a medianoche', () => {
      const fecha = new Date(2026, 10, 3)

      expect(parseIsoDate(toIsoDate(fecha)).getTime()).toBe(fecha.getTime())
    })

    it.each([
      ['una fecha que no existe', '2026-02-30'],
      ['mes y día sin cero a la izquierda', '2026-1-3'],
      ['un texto vacío', ''],
      ['el formato DD/MM/AAAA', '03/11/2026'],
    ])('rechaza %s ("%s")', (_descripcion, valor) => {
      expect(() => parseIsoDate(valor)).toThrow(Error)
    })
  })

  describe('normalizeTime', () => {
    it('quita los segundos de "08:00:00"', () => {
      expect(normalizeTime('08:00:00')).toBe('08:00')
    })

    it.each(['23:59', '00:00', '07:30'])('deja "%s" igual', (hora) => {
      expect(normalizeTime(hora)).toBe(hora)
    })

    it.each([
      ['una hora 24', '24:00'],
      ['la hora sin cero a la izquierda', '8:00'],
      ['minutos fuera de rango', '08:60'],
      ['segundos fuera de rango', '08:00:60'],
    ])('rechaza %s ("%s")', (_descripcion, valor) => {
      expect(() => normalizeTime(valor)).toThrow(Error)
    })
  })

  describe('formatWeekRange', () => {
    it('mismo mes: "1 - 7 nov 2026"', () => {
      expect(formatWeekRange('2026-11-01', '2026-11-07')).toBe('1 - 7 nov 2026')
    })

    it('meses distintos del mismo año: "29 nov - 5 dic 2026"', () => {
      expect(formatWeekRange('2026-11-29', '2026-12-05')).toBe('29 nov - 5 dic 2026')
    })

    it('años distintos: "27 dic 2026 - 2 ene 2027"', () => {
      expect(formatWeekRange('2026-12-27', '2027-01-02')).toBe('27 dic 2026 - 2 ene 2027')
    })

    it('encadenado con getWeekRange del martes 2026-11-03', () => {
      const { from, to } = getWeekRange('2026-11-03')

      expect(formatWeekRange(from, to)).toBe('1 - 7 nov 2026')
    })
  })
})
