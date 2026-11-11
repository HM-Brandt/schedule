import { useDraggable } from '@dnd-kit/react'
import type { Employee } from '../../api/types'
import { employeeHue } from '../../lib/colors'
import { fullName, initials } from '../../lib/employees'
import styles from './EmployeeItem.module.css'

export function EmployeeItem({ employee }: { employee: Employee }) {
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
      <span className={styles.title}>{employee.title}</span>
    </li>
  )
}
