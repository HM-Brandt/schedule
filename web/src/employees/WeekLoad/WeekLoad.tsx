import type { IsoDate } from '../../api/types'
import { formatDayName } from '../../lib/dates'
import styles from './WeekLoad.module.css'

export function WeekLoad({
  days,
  today,
  load,
  fill,
  className,
}: {
  days: IsoDate[]
  today: IsoDate
  load: Map<IsoDate, number> | undefined
  fill?: boolean
  className?: string
}) {
  const assigned = days
    .filter((day) => load?.get(day))
    .map((day) => `${formatDayName(day)} (${load?.get(day)})`)

  return (
    <span role="img" aria-label={`Assigned: ${assigned.join(', ') || 'none'}`} className={[styles.week, fill && styles.fill, className].filter(Boolean).join(' ')}>
      {days.map((day) => (
        <span
          key={day}
          aria-hidden
          className={styles.day}
          data-level={Math.min(load?.get(day) ?? 0, 2)}
          data-today={day === today || undefined}
        >
          {formatDayName(day).charAt(0)}
        </span>
      ))}
    </span>
  )
}
