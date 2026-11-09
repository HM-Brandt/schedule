import { useDroppable } from '@dnd-kit/react'
import type { Employee, IsoDate, Schedule } from '../../api/types'
import { ACCEPTS } from '../../dnd/dropResolution'
import { useAcceptsDrag } from '../../dnd/useAcceptsDrag'
import { useDraggedEmployeeId } from '../../dnd/useDraggedEmployeeId'
import { parseIsoDate } from '../../lib/dates'
import { DayHeading } from '../DayHeading'
import { ScheduleCard } from '../ScheduleCard'
import styles from './DayColumn.module.css'

export function DayColumn({
  date,
  isToday,
  schedules,
  employeesById,
  onOpenSchedule,
  onAssignSchedule,
}: {
  date: IsoDate
  isToday: boolean
  schedules: Schedule[]
  employeesById: Map<number, Employee>
  onOpenSchedule?: (schedule: Schedule) => void
  onAssignSchedule?: (schedule: Schedule) => void
}) {
  const { ref, isDropTarget } = useDroppable({ id: `day-${date}`, type: 'day', accept: ACCEPTS.day, data: { kind: 'day', date } })
  const accepting = useAcceptsDrag('day')
  const employeeId = useDraggedEmployeeId()
  const load = employeeId === null ? 0 : schedules.filter((schedule) => schedule.employee_ids.includes(employeeId)).length

  return (
    <div
      ref={ref}
      className={[
        styles.day,
        [0, 6].includes(parseIsoDate(date).getDay()) && styles.weekend,
        isToday && styles.today,
        accepting && styles.accepting,
        isDropTarget && styles.over,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <DayHeading date={date} isToday={isToday} />
      {load > 0 && <div className={styles.load}>{load === 1 ? '1 job' : `${load} jobs`}</div>}
      <div className={styles.cards}>
        {schedules.map((schedule) => (
          <ScheduleCard
            key={schedule.id}
            schedule={schedule}
            employeesById={employeesById}
            onOpen={onOpenSchedule}
            onAssign={onAssignSchedule}
          />
        ))}
      </div>
    </div>
  )
}
