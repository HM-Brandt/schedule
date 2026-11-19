import type { Absence, IsoDate } from '../../api/types'
import { formatDayName } from '../../lib/dates'
import styles from './WeekLoad.module.css'

export function WeekLoad({
  days,
  today,
  load,
  absences,
  fill,
  className,
}: {
  days: IsoDate[]
  today: IsoDate
  load: Map<IsoDate, number> | undefined
  absences?: Map<IsoDate, Absence>
  fill?: boolean
  className?: string
}) {
  const assigned = days
    .filter((day) => load?.get(day))
    .map((day) => `${formatDayName(day)} (${load?.get(day)})`)
  const absent = days
    .filter((day) => absences?.has(day))
    .map((day) => `${formatDayName(day)} (${absences?.get(day)?.absenceType})`)

  return (
    <span
      role="img"
      aria-label={`Assigned: ${assigned.join(', ') || 'none'}${absent.length ? `. Absent: ${absent.join(', ')}` : ''}`}
      className={[styles.week, fill && styles.fill, className].filter(Boolean).join(' ')}
    >
      {days.map((day) => (
        <span
          key={day}
          aria-hidden
          className={styles.day}
          data-level={absences?.has(day) ? 'absent' : Math.min(load?.get(day) ?? 0, 2)}
          data-today={day === today || undefined}
        >
          {formatDayName(day).charAt(0)}
        </span>
      ))}
    </span>
  )
}
