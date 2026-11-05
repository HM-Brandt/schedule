import type { IsoDate } from '../../api/types'
import { formatWeekRange } from '../../lib/dates'
import styles from './WeekHeader.module.css'

export function WeekHeader({
  from,
  to,
  onPrevious,
  onNext,
  onToday,
}: {
  from: IsoDate
  to: IsoDate
  onPrevious: () => void
  onNext: () => void
  onToday: () => void
}) {
  return (
    <div className={styles.header}>
      <h2 className={styles.range}>{formatWeekRange(from, to)}</h2>
      <div className={styles.actions}>
        <button type="button" className={styles.button} aria-label="Previous week" onClick={onPrevious}>
          ‹
        </button>
        <button type="button" className={styles.button} onClick={onToday}>
          Today
        </button>
        <button type="button" className={styles.button} aria-label="Next week" onClick={onNext}>
          ›
        </button>
      </div>
    </div>
  )
}
