import { useDraggable } from '@dnd-kit/react'
import type { Absence, Employee } from '../../api/types'
import { fullName } from '../../lib/employees'
import styles from './AbsenceChip.module.css'

export function AbsenceChip({ absence, employee }: { absence: Absence; employee: Employee }) {
  const { ref } = useDraggable({
    id: `absence-${absence.employeeAbsencesId}`,
    type: 'absence',
    data: {
      kind: 'absence',
      employeeAbsencesId: absence.employeeAbsencesId,
      employeeId: absence.employeesId,
      date: absence.date,
    },
    disabled: absence.employeeAbsencesId < 0,
  })

  return (
    <div ref={ref} className={styles.chip} title={absence.absenceComment ?? undefined}>
      <span className={styles.name}>{fullName(employee)}</span>
      <span className={styles.type}>{absence.absenceType}</span>
    </div>
  )
}
