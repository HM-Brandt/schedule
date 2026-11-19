import { format } from 'date-fns'
import { ArrowRightLeft, Copy, MapPin, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import type { Absence, Employee, IsoDate, Schedule } from '../../api/types'
import { parseIsoDate } from '../../lib/dates'
import { employeeHue, jobHue } from '../../lib/colors'
import { fullName, initials } from '../../lib/employees'
import { absenceLookup, absentEmployees } from '../../lib/selectors'
import { useScheduleActions } from '../../undo/useScheduleActions'
import styles from './ScheduleDetail.module.css'

const formatDate = (date: IsoDate) => format(parseIsoDate(date), 'EEE, MMM d')

export function ScheduleDetail({
  scheduleId,
  schedules,
  absences,
  days,
  employeesById,
  onClose,
}: {
  scheduleId: number
  schedules: Schedule[]
  absences: Absence[]
  days: IsoDate[]
  employeesById: Map<number, Employee>
  onClose: () => void
}) {
  const actions = useScheduleActions(schedules, absences)
  const lookup = useMemo(() => absenceLookup(absences), [absences])
  const panelRef = useRef<HTMLElement>(null)
  const schedule = schedules.find((item) => item.jobSchedulesId === scheduleId)

  useEffect(() => {
    if (!schedule) onClose()
  }, [schedule, onClose])

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) onClose()
    }
    document.addEventListener('click', closeOutside, true)
    return () => document.removeEventListener('click', closeOutside, true)
  }, [onClose])

  if (!schedule) return null
  const employees = schedule.employeesIds.flatMap((id) => employeesById.get(id) ?? [])
  const saveTime = (value: string) => {
    if (value && value !== schedule.startTime) actions.setStartTime(schedule, value)
  }
  const moveTo = (date: IsoDate) => {
    const absent = absentEmployees(schedule.employeesIds, date, lookup)
    if (absent.length > 0) actions.blockMove(absent, date)
    else actions.move(schedule, date)
  }

  return (
    <aside ref={panelRef} role="dialog" aria-label={`${schedule.job.number} ${schedule.job.name}`} className={styles.panel} data-hue={jobHue(schedule.job.jobsId)}>
      <div className={styles.number}>{schedule.job.number}</div>
      <h2 className={styles.name}>{schedule.job.name}</h2>
      {schedule.job.type && <div className={styles.date}>{schedule.job.type}</div>}
      {schedule.job.address && (
        <a
          className={styles.address}
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(schedule.job.address)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MapPin size={14} />
          {schedule.job.address}
        </a>
      )}
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
          onChange={(event) => event.target.value !== schedule.date && moveTo(event.target.value)}
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
