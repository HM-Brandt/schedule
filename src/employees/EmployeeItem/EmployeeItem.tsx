import { useDraggable } from '@dnd-kit/react'
import type { Employee, IsoDate } from '../../api/types'
import { employeeHue } from '../../lib/colors'
import { formatHours, fullName, initials } from '../../lib/employees'
import { WeekLoad } from '../WeekLoad'
import styles from './EmployeeItem.module.css'

export function EmployeeItem({
  employee,
  days,
  today,
  load,
  hours,
}: {
  employee: Employee
  days: IsoDate[]
  today: IsoDate
  load: Map<IsoDate, number> | undefined
  hours: number | undefined
}) {
  const { ref } = useDraggable({
    id: `employee-${employee.employeesId}`,
    type: 'employee',
    data: { kind: 'employee', employeeId: employee.employeesId },
  })

  return (
    <li ref={ref} role="listitem" className={styles.employee}>
      <span className={styles.initials} data-hue={employeeHue(employee.employeesId)}>
        {initials(employee)}
      </span>
      <span className={styles.name}>{fullName(employee)}</span>
      <span className={styles.title}>
        {employee.title}
        {hours !== undefined && ` · ${formatHours(hours)}`}
      </span>
      <WeekLoad days={days} today={today} load={load} fill className={styles.week} />
    </li>
  )
}
