import { useDroppable } from '@dnd-kit/react'
import { useContext, useEffect } from 'react'
import type { Absence, Employee, IsoDate } from '../../api/types'
import { ACCEPTS } from '../../dnd/dropResolution'
import { AbsenceAlertContext } from '../../dnd/ScheduleDndProvider'
import { useDraggedEmployeeId } from '../../dnd/useDraggedEmployeeId'
import { AbsenceChip } from '../AbsenceChip'
import styles from './AbsenceZone.module.css'

export function AbsenceZone({
  date,
  absences,
  employeesById,
  className,
}: {
  date: IsoDate
  absences: Absence[]
  employeesById: Map<number, Employee>
  className?: string
}) {
  const { ref, droppable, isDropTarget } = useDroppable({
    id: `absences-${date}`,
    type: 'absences',
    accept: ACCEPTS.absences,
    data: { kind: 'absences', date },
  })
  const accepting = useDraggedEmployeeId() !== null
  const { absenceAlert, clearAbsenceAlert } = useContext(AbsenceAlertContext)
  const alert = absenceAlert?.date === date ? absenceAlert : null

  useEffect(() => {
    if (!alert) return
    droppable.element?.scrollIntoView?.({
      block: 'nearest',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }, [alert, droppable])

  return (
    <div
      key={alert?.n}
      ref={ref}
      onAnimationEnd={alert ? clearAbsenceAlert : undefined}
      className={[
        styles.zone,
        className,
        absences.length > 0 && styles.filled,
        accepting && styles.accepting,
        accepting && isDropTarget && styles.over,
        alert && styles.blocked,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={styles.title}>Absences</div>
      {absences.length === 0 ? (
        <div className={styles.empty}>No absences</div>
      ) : (
        <div className={styles.chips}>
          {absences.flatMap((absence) => {
            const employee = employeesById.get(absence.employeesId)
            return employee ? [<AbsenceChip key={absence.employeeAbsencesId} absence={absence} employee={employee} />] : []
          })}
        </div>
      )}
    </div>
  )
}
