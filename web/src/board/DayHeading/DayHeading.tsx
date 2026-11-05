import type { IsoDate } from '../../api/types'
import { dayOfMonth, formatDayName } from '../../lib/dates'
import styles from './DayHeading.module.css'

export function DayHeading({ date, isToday }: { date: IsoDate; isToday: boolean }) {
  return (
    <div className={isToday ? `${styles.heading} ${styles.today}` : styles.heading} aria-current={isToday ? 'date' : undefined}>
      <span className={styles.name}>{formatDayName(date)}</span>
      <span className={styles.number}>{dayOfMonth(date)}</span>
    </div>
  )
}
