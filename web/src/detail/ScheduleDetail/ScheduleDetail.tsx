import { format } from 'date-fns'
import { ArrowRightLeft, Copy, Trash2, X } from 'lucide-react'
import { useEffect } from 'react'
import type { Employee, IsoDate, Schedule } from '../../api/types'
import { parseIsoDate } from '../../lib/dates'
import { employeeHue, jobHue } from '../../lib/colors'
import { fullName, initials } from '../../lib/employees'
import { useScheduleActions } from '../../undo/useScheduleActions'
import styles from './ScheduleDetail.module.css'

const formatDate = (date: IsoDate) => format(parseIsoDate(date), 'EEE, MMM d')

export function ScheduleDetail({
  scheduleId,
  schedules,
  days,
  employeesById,
  onClose,
}: {
  scheduleId: number
  schedules: Schedule[]
  days: IsoDate[]
  employeesById: Map<number, Employee>
  onClose: () => void
}) {
  const actions = useScheduleActions(schedules)
  const schedule = schedules.find((item) => item.jobSchedulesId === scheduleId)

  useEffect(() => {
    if (!schedule) onClose()
  }, [schedule, onClose])

  if (!schedule) return null
  const employees = schedule.employeesIds.flatMap((id) => employeesById.get(id) ?? [])
  const saveTime = (value: string) => {
    if (value && value !== schedule.startTime) actions.setStartTime(schedule, value)
  }

  return (
    <aside role="dialog" aria-label={`${schedule.job.number} ${schedule.job.name}`} className={styles.panel} data-hue={jobHue(schedule.job.jobsId)}>
      <div className={styles.number}>{schedule.job.number}</div>
      <h2 className={styles.name}>{schedule.job.name}</h2>
      <div className={styles.date}>{formatDate(schedule.date)}</div>
      <label className={styles.field}>
        Start time
        <input
          key={`${schedule.jobSchedulesId}-${schedule.startTime}`}
          className={styles.input}
          type="time"
          aria-label="Start time"
          defaultValue={schedule.startTime}
          onBlur={(event) => saveTime(event.currentTarget.value)}
          onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
        />
      </label>
      <label className={styles.field}>
        Comment
        <textarea
          key={`${schedule.jobSchedulesId}-${schedule.scheduleComment}`}
          className={`${styles.input} ${styles.comment}`}
          aria-label="Comment"
          defaultValue={schedule.scheduleComment ?? ''}
          onBlur={(event) => actions.setComment(schedule, event.currentTarget.value)}
        />
      </label>
      <ul className={styles.employees}>
        {employees.map((employee) => (
          <li key={employee.employeesId} className={styles.employee}>
            <span
              className={employee.status === 'Terminated' ? `${styles.avatar} ${styles.inactive}` : styles.avatar}
              data-hue={employeeHue(employee.employeesId)}
            >
              {initials(employee)}
            </span>
            {employee.status === 'Terminated' ? `${fullName(employee)} (inactive)` : fullName(employee)}
            <button
              type="button"
              className={styles.button}
              aria-label={`Remove ${fullName(employee)}`}
              onClick={() =>
                actions.setEmployees(
                  schedule,
                  schedule.employeesIds.filter((id) => id !== employee.employeesId),
                )
              }
            >
              <Trash2 />
              Remove
            </button>
          </li>
        ))}
      </ul>
      <label className={styles.field}>
        <span className={styles.label}>
          <ArrowRightLeft />
          Move to…
        </span>
        <select
          className={styles.input}
          aria-label="Move to"
          value={schedule.date}
          onChange={(event) => event.target.value !== schedule.date && actions.move(schedule, event.target.value)}
        >
          {days.map((day) => (
            <option key={day} value={day}>
              {formatDate(day)}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={() => actions.duplicate(schedule, schedule.date)}>
          <Copy />
          Duplicate
        </button>
        <button
          type="button"
          className={`${styles.button} ${styles.danger}`}
          onClick={() => {
            actions.remove(schedule)
            onClose()
          }}
        >
          <Trash2 />
          Remove
        </button>
        <button type="button" className={styles.button} onClick={onClose}>
          <X />
          Close
        </button>
      </div>
    </aside>
  )
}
