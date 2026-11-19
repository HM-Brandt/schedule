import { useDroppable } from '@dnd-kit/react'
import type { Absence, Employee, IsoDate } from '../../api/types'
import { ACCEPTS } from '../../dnd/dropResolution'
import { useDraggedEmployeeId } from '../../dnd/useDraggedEmployeeId'
import { AbsenceChip } from '../AbsenceChip'
import styles from './AbsenceZone.module.css'

export function AbsenceZone({
  date,
  absences,
  employeesById,
}: {
  date: IsoDate
  absences: Absence[]
  employeesById: Map<number, Employee>
}) {
  const { ref, isDropTarget } = useDroppable({
    id: `absences-${date}`,
    type: 'absences',
    accept: ACCEPTS.absences,
    data: { kind: 'absences', date },
  })
  const accepting = useDraggedEmployeeId() !== null

  return (
    <div
      ref={ref}
      className={[styles.zone, accepting && styles.accepting, accepting && isDropTarget && styles.over]
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
