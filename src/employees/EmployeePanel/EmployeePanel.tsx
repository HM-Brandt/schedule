import { useMemo } from 'react'
import type { Employee, IsoDate, Schedule } from '../../api/types'
import { panelEmployees } from '../../lib/employees'
import { employeeDayCounts } from '../../lib/selectors'
import { EmployeeItem } from '../EmployeeItem'
import styles from './EmployeePanel.module.css'

export function EmployeePanel({
  employees,
  error,
  schedules,
  days,
  today,
  hours,
}: {
  employees: Employee[]
  error: Error | null
  schedules: Schedule[]
  days: IsoDate[]
  today: IsoDate
  hours: Map<number, number> | undefined
}) {
  const counts = useMemo(() => employeeDayCounts(schedules), [schedules])

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>Employees</h2>
      {error && (
        <p role="alert" className={styles.error}>
          Couldn't load employees. {error.message}
        </p>
      )}
      <ul className={styles.list}>
        {panelEmployees(employees)
          .map((employee) => (
            <EmployeeItem
              key={employee.employeesId}
              employee={employee}
              days={days}
              today={today}
              load={counts.get(employee.employeesId)}
              hours={hours ? (hours.get(employee.employeesId) ?? 0) : undefined}
            />
          ))}
      </ul>
    </section>
  )
}
