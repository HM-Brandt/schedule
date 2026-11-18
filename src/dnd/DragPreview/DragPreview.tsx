import { useEmployees } from '../../api/queries'
import { employeeHue, jobHue } from '../../lib/colors'
import { fullName, initials } from '../../lib/employees'
import type { DragData } from '../dropResolution'
import styles from './DragPreview.module.css'

export function DragPreview({ source }: { source: { data: unknown } }) {
  const employees = useEmployees()
  const data = source.data as DragData

  if (data.kind === 'catalog-job') {
    return (
      <div className={styles.job} data-hue={jobHue(data.job.jobsId)}>
        <span className={styles.number}>{data.job.number}</span>
        <span className={styles.name}>{data.job.name}</span>
      </div>
    )
  }

  const employee =
    data.kind === 'employee' ? employees.data?.find((item) => item.employeesId === data.employeeId) : undefined
  if (!employee) return null

  return (
    <div className={styles.job} data-hue={employeeHue(employee.employeesId)}>
      <span className={styles.initials}>{initials(employee)}</span>
      <span className={styles.name}>{fullName(employee)}</span>
    </div>
  )
}
