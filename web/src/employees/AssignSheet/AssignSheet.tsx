import { useEffect } from 'react'
import type { Employee, Schedule } from '../../api/types'
import { BottomSheet } from '../../layout/BottomSheet'
import { employeeHue } from '../../lib/colors'
import { fullName, initials } from '../../lib/employees'
import { useScheduleActions } from '../../undo/useScheduleActions'
import styles from './AssignSheet.module.css'

export function AssignSheet({
  schedule,
  employees,
  schedules,
  onClose,
}: {
  schedule: Schedule
  employees: Employee[]
  schedules: Schedule[]
  onClose: () => void
}) {
  const actions = useScheduleActions(schedules)
  const current = schedules.find((item) => item.id === schedule.id)

  useEffect(() => {
    if (!current) onClose()
  }, [current, onClose])

  if (!current) return null

  return (
    <BottomSheet title="Assign employees" onClose={onClose}>
      <ul className={styles.list}>
        {employees
          .filter((employee) => employee.status === 'activo')
          .map((employee) => {
            const assigned = current.employee_ids.includes(employee.id)
            const load = schedules.filter(
              (item) => item.date === current.date && item.employee_ids.includes(employee.id),
            ).length
            return (
              <li key={employee.id} className={styles.row}>
                <label className={styles.label}>
                  <input
                    type="checkbox"
                    aria-label={fullName(employee)}
                    checked={assigned}
                    onChange={() =>
                      actions.setEmployees(
                        current,
                        assigned
                          ? current.employee_ids.filter((id) => id !== employee.id)
                          : [...current.employee_ids, employee.id],
                      )
                    }
                  />
                  <span className={styles.avatar} data-hue={employeeHue(employee.id)}>
                    {initials(employee)}
                  </span>
                  {fullName(employee)}
                </label>
                {load > 0 && <span className={styles.load}>{load === 1 ? '1 job' : `${load} jobs`}</span>}
              </li>
            )
          })}
      </ul>
    </BottomSheet>
  )
}
