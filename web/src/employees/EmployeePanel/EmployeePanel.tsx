import type { Employee } from '../../api/types'
import { EmployeeItem } from '../EmployeeItem'
import styles from './EmployeePanel.module.css'

export function EmployeePanel({ employees, error }: { employees: Employee[]; error: Error | null }) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>Employees</h2>
      {error && (
        <p role="alert" className={styles.error}>
          Couldn't load employees. {error.message}
        </p>
      )}
      <ul className={styles.list}>
        {employees
          .filter((employee) => employee.status === 'activo')
          .map((employee) => (
            <EmployeeItem key={employee.id} employee={employee} />
          ))}
      </ul>
    </section>
  )
}
