import { useMemo } from 'react'
import type { Absence, Employee, IsoDate, Schedule } from '../../api/types'
import { panelEmployees } from '../../lib/employees'
import { absenceLookup, employeeDayCounts } from '../../lib/selectors'
import { EmployeeItem } from '../EmployeeItem'
import styles from './EmployeePanel.module.css'

export function EmployeePanel({
  employees,
  error,
  schedules,
  absences,
  days,
  today,
  hours,
}: {
  employees: Employee[]
  error: Error | null
  schedules: Schedule[]
  absences: Absence[]
  days: IsoDate[]
  today: IsoDate
  hours: Map<number, number> | undefined
}) {
  const counts = useMemo(() => employeeDayCounts(schedules), [schedules])
  const lookup = useMemo(() => absenceLookup(absences), [absences])

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
              absences={lookup.get(employee.employeesId)}
              hours={hours ? (hours.get(employee.employeesId) ?? 0) : undefined}
            />
          ))}
      </ul>
    </section>
  )
}
