import { useEffect, useMemo } from 'react'
import type { Employee, IsoDate, Schedule } from '../../api/types'
import { BottomSheet } from '../../layout/BottomSheet'
import { employeeHue } from '../../lib/colors'
import { fullName, initials } from '../../lib/employees'
import { employeeDayCounts } from '../../lib/selectors'
import { useScheduleActions } from '../../undo/useScheduleActions'
import { WeekLoad } from '../WeekLoad'
import styles from './AssignSheet.module.css'

export function AssignSheet({
  schedule,
  employees,
  schedules,
  days,
  today,
  onClose,
}: {
  schedule: Schedule
  employees: Employee[]
  schedules: Schedule[]
  days: IsoDate[]
  today: IsoDate
  onClose: () => void
}) {
  const actions = useScheduleActions(schedules)
  const counts = useMemo(() => employeeDayCounts(schedules), [schedules])
  const current = schedules.find((item) => item.jobSchedulesId === schedule.jobSchedulesId)

  useEffect(() => {
    if (!current) onClose()
  }, [current, onClose])

  if (!current) return null

  return (
    <BottomSheet title="Assign employees" onClose={onClose}>
      <ul className={styles.list}>
        {employees
          .filter((employee) => employee.status === 'Active')
          .map((employee) => {
            const assigned = current.employeesIds.includes(employee.employeesId)
            const load = schedules.filter(
              (item) => item.date === current.date && item.employeesIds.includes(employee.employeesId),
            ).length
            return (
              <li key={employee.employeesId} className={styles.row}>
                <label className={styles.label}>
                  <input
                    type="checkbox"
                    aria-label={fullName(employee)}
                    checked={assigned}
                    onChange={() =>
                      actions.setEmployees(
                        current,
                        assigned
                          ? current.employeesIds.filter((id) => id !== employee.employeesId)
                          : [...current.employeesIds, employee.employeesId],
                      )
                    }
                  />
                  <span className={styles.avatar} data-hue={employeeHue(employee.employeesId)}>
                    {initials(employee)}
                  </span>
                  <span className={styles.name}>
                    {fullName(employee)}
                    <WeekLoad days={days} today={today} load={counts.get(employee.employeesId)} />
                  </span>
                </label>
                {load > 0 && <span className={styles.load}>{load === 1 ? '1 job' : `${load} jobs`}</span>}
              </li>
            )
          })}
      </ul>
    </BottomSheet>
  )
}
