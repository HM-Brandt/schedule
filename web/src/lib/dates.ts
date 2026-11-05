import { addDays, format, startOfWeek } from 'date-fns'
import type { IsoDate, StartTime } from '../api/types'

/** Abreviaturas de los meses en español, sin punto, de enero a diciembre. */
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/

/**
 * Devuelve la fecha como texto `YYYY-MM-DD` según la hora local, nunca en UTC.
 * Así una fecha local de domingo por la noche sigue siendo ese domingo.
 */
export function toIsoDate(date: Date): IsoDate {
  return format(date, 'yyyy-MM-dd')
}

/**
 * Convierte un texto `YYYY-MM-DD` en un `Date` a medianoche local.
 * No usa `new Date('YYYY-MM-DD')`, que se interpreta en UTC y puede caer en el día anterior.
 * Lanza un `Error` si el texto no tiene ese formato o no es una fecha real (por ejemplo `2026-02-30`).
 */
export function parseIsoDate(iso: IsoDate): Date {
  const match = ISO_DATE_PATTERN.exec(iso)
  if (!match) {
    throw new Error(`La fecha "${iso}" no tiene el formato AAAA-MM-DD`)
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error(`La fecha "${iso}" no existe`)
  }
  return date
}

/**
 * Devuelve la semana de domingo a sábado que contiene la fecha, como textos `YYYY-MM-DD`.
 * `weekStartsOn: 0` es explícito porque el locale `es` empieza la semana en lunes.
 */
export function getWeekRange(date: Date | IsoDate): { from: IsoDate; to: IsoDate } {
  const base = typeof date === 'string' ? parseIsoDate(date) : date
  const start = startOfWeek(base, { weekStartsOn: 0 })
  return { from: toIsoDate(start), to: toIsoDate(addDays(start, 6)) }
}

export function getWeekDays(from: IsoDate): IsoDate[] {
  const start = parseIsoDate(from)
  return Array.from({ length: 7 }, (_, index) => toIsoDate(addDays(start, index)))
}

/**
 * Normaliza una hora a `HH:mm`: quita los segundos de `HH:mm:ss` y deja `HH:mm` igual.
 * Acepta horas de 00 a 23 y minutos y segundos de 00 a 59; ante otro formato lanza un `Error`.
 */
export function normalizeTime(value: string): StartTime {
  const match = TIME_PATTERN.exec(value)
  if (!match) {
    throw new Error(`La hora "${value}" no tiene el formato HH:mm o HH:mm:ss`)
  }
  return `${match[1]}:${match[2]}`
}

/**
 * Da el texto de un rango de fechas para el encabezado de la semana, con días sin cero
 * a la izquierda y meses abreviados sin punto:
 * - mismo mes y año: `"1 - 7 nov 2026"`;
 * - meses distintos del mismo año: `"29 nov - 5 dic 2026"`;
 * - años distintos: `"27 dic 2026 - 2 ene 2027"`.
 */
export function formatWeekRange(from: IsoDate, to: IsoDate): string {
  const start = parseIsoDate(from)
  const end = parseIsoDate(to)
  const startDay = start.getDate()
  const endDay = end.getDate()
  const startMonth = MONTHS[start.getMonth()]
  const endMonth = MONTHS[end.getMonth()]
  const startYear = start.getFullYear()
  const endYear = end.getFullYear()

  if (startYear !== endYear) {
    return `${startDay} ${startMonth} ${startYear} - ${endDay} ${endMonth} ${endYear}`
  }
  if (start.getMonth() !== end.getMonth()) {
    return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${endYear}`
  }
  return `${startDay} - ${endDay} ${endMonth} ${endYear}`
}
