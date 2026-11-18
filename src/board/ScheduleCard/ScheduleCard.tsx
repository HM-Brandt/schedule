import { useDraggable, useDroppable } from '@dnd-kit/react'
import { Clock, MessageSquare, UserPlus } from 'lucide-react'
import { useCallback } from 'react'
import type { Employee, Schedule } from '../../api/types'
import { ACCEPTS } from '../../dnd/dropResolution'
import { useAcceptsDrag } from '../../dnd/useAcceptsDrag'
import { employeeHue, jobHue } from '../../lib/colors'
import { fullName, initials } from '../../lib/employees'
import styles from './ScheduleCard.module.css'

const MAX_INITIALS = 4

function EmployeeChip({ employee, scheduleId }: { employee: Employee; scheduleId: number }) {
  const { ref } = useDraggable({
    id: `employee-${employee.employeesId}-in-${scheduleId}`,
    type: 'employee',
    data: { kind: 'employee', employeeId: employee.employeesId, fromScheduleId: scheduleId },
    disabled: scheduleId < 0,
  })

  return (
    <span ref={ref} className={styles.initials} title={fullName(employee)} data-hue={employeeHue(employee.employeesId)}>
      {initials(employee)}
    </span>
  )
}

export function ScheduleCard({
  schedule,
  employeesById,
  onOpen,
  onAssign,
}: {
  schedule: Schedule
  employeesById: Map<number, Employee>
  onOpen?: (schedule: Schedule) => void
  onAssign?: (schedule: Schedule) => void
}) {
  const employees = schedule.employeesIds.flatMap((id) => employeesById.get(id) ?? [])
  const visible = employees.slice(0, MAX_INITIALS)
  const hidden = employees.slice(MAX_INITIALS)
  const { ref: dragRef } = useDraggable({
    id: `schedule-${schedule.jobSchedulesId}`,
    type: 'schedule-card',
    data: { kind: 'schedule-card', schedule },
    disabled: schedule.jobSchedulesId < 0,
  })
  const { ref: dropRef, isDropTarget } = useDroppable({
    id: `card-${schedule.jobSchedulesId}`,
    type: 'schedule-card',
    accept: ACCEPTS['schedule-card'],
    data: { kind: 'schedule-card', schedule },
    disabled: schedule.jobSchedulesId < 0,
  })
  const accepting = useAcceptsDrag('schedule-card')
  const ref = useCallback(
    (element: Element | null) => {
      dragRef(element)
      dropRef(element)
    },
    [dragRef, dropRef],
  )

  return (
    <article
      ref={ref}
      role="article"
      className={[styles.card, accepting && styles.accepting, isDropTarget && styles.over].filter(Boolean).join(' ')}
      data-hue={jobHue(schedule.job.jobsId)}
      onClick={() => schedule.jobSchedulesId >= 0 && onOpen?.(schedule)}
    >
      <div className={styles.top}>
        <span className={styles.number}>{schedule.job.number}</span>
        <span className={styles.time}>
          <Clock size={14} />
          {schedule.startTime}
        </span>
        {schedule.scheduleComment && (
          <span
            className={styles.comment}
            title={schedule.scheduleComment}
            aria-label={`Comment: ${schedule.scheduleComment}`}
          >
            <MessageSquare size={14} />
          </span>
        )}
        {onAssign && (
          <button
            type="button"
            className={styles.assign}
            aria-label="Assign employees"
            onClick={(event) => {
              event.stopPropagation()
              if (schedule.jobSchedulesId >= 0) onAssign(schedule)
            }}
          >
            <UserPlus size={14} />
          </button>
        )}
      </div>
      <div className={styles.name} title={schedule.job.name}>
        {schedule.job.name}
      </div>
      {schedule.employeesIds.length > 0 ? (
        <div className={styles.employees}>
          {visible.map((employee) =>
            employee.status === 'Terminated' ? (
              <span
                key={employee.employeesId}
                className={`${styles.initials} ${styles.inactive}`}
                title={`${fullName(employee)} (inactive)`}
              >
                {initials(employee)}
              </span>
            ) : (
              <EmployeeChip key={employee.employeesId} employee={employee} scheduleId={schedule.jobSchedulesId} />
            ),
          )}
          {hidden.length > 0 && (
            <span className={styles.more} title={hidden.map(fullName).join(', ')}>
              {`+${hidden.length}`}
            </span>
          )}
        </div>
      ) : (
        <div className={styles.empty}>No employees</div>
      )}
    </article>
  )
}
