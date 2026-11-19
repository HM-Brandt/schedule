import type { Absence, Employee, IsoDate, Schedule } from '../../api/types'
import { DayColumn } from '../DayColumn'
import styles from './WeekBoard.module.css'

export function WeekBoard({
  days,
  today,
  schedulesByDay,
  absencesByDay,
  employeesById,
  onOpenSchedule,
  onAssignSchedule,
}: {
  days: IsoDate[]
  today: IsoDate
  schedulesByDay: Record<IsoDate, Schedule[]>
  absencesByDay: Record<IsoDate, Absence[]>
  employeesById: Map<number, Employee>
  onOpenSchedule?: (schedule: Schedule) => void
  onAssignSchedule?: (schedule: Schedule) => void
}) {
  return (
    <div className={styles.board}>
      {days.map((day) => (
        <DayColumn
          key={day}
          date={day}
          isToday={day === today}
          schedules={schedulesByDay[day]}
          absences={absencesByDay[day]}
          employeesById={employeesById}
          onOpenSchedule={onOpenSchedule}
          onAssignSchedule={onAssignSchedule}
        />
      ))}
    </div>
  )
}
