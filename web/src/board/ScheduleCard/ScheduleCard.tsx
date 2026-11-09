import { useDraggable } from '@dnd-kit/react'
import type { Employee, Schedule } from '../../api/types'
import { fullName, initials } from '../../lib/employees'
import styles from './ScheduleCard.module.css'

export function ScheduleCard({ schedule, employeesById }: { schedule: Schedule; employeesById: Map<number, Employee> }) {
  const employees = schedule.employee_ids.flatMap((id) => employeesById.get(id) ?? [])
  const { ref } = useDraggable({
    id: `schedule-${schedule.id}`,
    type: 'schedule-card',
    data: { kind: 'schedule-card', schedule },
    disabled: schedule.id < 0,
  })

  return (
    <article ref={ref} role="article" className={styles.card}>
      <div className={styles.top}>
        <span className={styles.number}>{schedule.job.number}</span>
        <span className={styles.time}>{schedule.start_time}</span>
      </div>
      <div className={styles.name}>{schedule.job.name}</div>
      {schedule.employee_ids.length > 0 ? (
        <div className={styles.employees}>
          {employees.map((employee) => (
            <span key={employee.id} className={styles.initials} title={fullName(employee)}>
              {initials(employee)}
            </span>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>No employees</div>
      )}
    </article>
  )
}
