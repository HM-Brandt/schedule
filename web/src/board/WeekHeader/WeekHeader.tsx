import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import type { IsoDate } from '../../api/types'
import { formatWeekRange } from '../../lib/dates'
import styles from './WeekHeader.module.css'

export function WeekHeader({
  from,
  to,
  onPrevious,
  onNext,
  onToday,
  children,
}: {
  from: IsoDate
  to: IsoDate
  onPrevious: () => void
  onNext: () => void
  onToday: () => void
  children?: ReactNode
}) {
  return (
    <div className={styles.header}>
      <h2 className={styles.range}>{formatWeekRange(from, to)}</h2>
      <div className={styles.actions}>
        <div className={styles.group}>
          <button type="button" className={styles.button} aria-label="Previous week" onClick={onPrevious}>
            <ChevronLeft />
          </button>
          <button type="button" className={styles.button} onClick={onToday}>
            Today
          </button>
          <button type="button" className={styles.button} aria-label="Next week" onClick={onNext}>
            <ChevronRight />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
