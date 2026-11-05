import type { Employee, IsoDate, Schedule } from '../../api/types'
import { DayHeading } from '../DayHeading'
import { ScheduleCard } from '../ScheduleCard'
import styles from './WeekBoard.module.css'

export function WeekBoard({
  days,
  today,
  schedulesByDay,
  employeesById,
}: {
  days: IsoDate[]
  today: IsoDate
  schedulesByDay: Record<IsoDate, Schedule[]>
  employeesById: Map<number, Employee>
}) {
  return (
    <div className={styles.board}>
      {days.map((day) => (
        <div key={day} className={styles.day}>
          <DayHeading date={day} isToday={day === today} />
          <div className={styles.cards}>
            {schedulesByDay[day].map((schedule) => (
              <ScheduleCard key={schedule.id} schedule={schedule} employeesById={employeesById} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
