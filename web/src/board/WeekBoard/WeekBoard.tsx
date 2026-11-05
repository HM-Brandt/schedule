import type { Employee, IsoDate, Schedule } from '../../api/types'
import { DayColumn } from '../DayColumn'
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
        <DayColumn
          key={day}
          date={day}
          isToday={day === today}
          schedules={schedulesByDay[day]}
          employeesById={employeesById}
        />
      ))}
    </div>
  )
}
