import type { IsoDate } from '../api/types'
import { DayHeading } from './DayHeading'
import styles from './WeekBoard.module.css'

export function WeekBoard({ days, today }: { days: IsoDate[]; today: IsoDate }) {
  return (
    <div className={styles.board}>
      {days.map((day) => (
        <div key={day} className={styles.day}>
          <DayHeading date={day} isToday={day === today} />
        </div>
      ))}
    </div>
  )
}
