import { useDroppable } from '@dnd-kit/react'
import type { Employee, IsoDate, Schedule } from '../../api/types'
import { ACCEPTS } from '../../dnd/dropResolution'
import { useAcceptsDrag } from '../../dnd/useAcceptsDrag'
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
  const { ref, isDropTarget } = useDroppable({ id: `day-${date}`, type: 'day', accept: ACCEPTS.day, data: { kind: 'day', date } })
  const accepting = useAcceptsDrag('day')

  return (
    <div
      ref={ref}
      className={[styles.day, accepting && styles.accepting, isDropTarget && styles.over].filter(Boolean).join(' ')}
    >
      <DayHeading date={date} isToday={isToday} />
      <div className={styles.cards}>
        {schedules.map((schedule) => (
          <ScheduleCard key={schedule.id} schedule={schedule} employeesById={employeesById} />
        ))}
      </div>
    </div>
  )
}
