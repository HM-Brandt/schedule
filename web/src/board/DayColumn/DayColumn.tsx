import { useDroppable } from '@dnd-kit/react'
import type { Employee, IsoDate, Schedule } from '../../api/types'
import { ACCEPTS } from '../../dnd/dropResolution'
import { DayHeading } from '../DayHeading'
import { ScheduleCard } from '../ScheduleCard'
import styles from './DayColumn.module.css'

export function DayColumn({
  date,
  isToday,
  schedules,
  employeesById,
}: {
  date: IsoDate
  isToday: boolean
  schedules: Schedule[]
  employeesById: Map<number, Employee>
}) {
  const { ref } = useDroppable({ id: `day-${date}`, type: 'day', accept: ACCEPTS.day, data: { kind: 'day', date } })

  return (
    <div ref={ref} className={styles.day}>
      <DayHeading date={date} isToday={isToday} />
      <div className={styles.cards}>
        {schedules.map((schedule) => (
          <ScheduleCard key={schedule.id} schedule={schedule} employeesById={employeesById} />
        ))}
      </div>
    </div>
  )
}
