import { format } from 'date-fns'
import { useEffect, useState } from 'react'
import type { AbsenceType, Employee, IsoDate } from '../../api/types'
import { parseIsoDate } from '../../lib/dates'
import { fullName } from '../../lib/employees'
import styles from './AbsenceDialog.module.css'

const TYPES: AbsenceType[] = ['Off', 'Vacation', 'Sick', 'Other']

export function AbsenceDialog({
  employee,
  date,
  onSave,
  onCancel,
}: {
  employee: Employee
  date: IsoDate
  onSave: (absence: { absenceType: AbsenceType; absenceComment: string | null }) => void
  onCancel: () => void
}) {
  const [absenceType, setAbsenceType] = useState<AbsenceType>('Off')
  const [comment, setComment] = useState('')

  useEffect(() => {
    const cancelOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && onCancel()
    document.addEventListener('keydown', cancelOnEscape)
    return () => document.removeEventListener('keydown', cancelOnEscape)
  }, [onCancel])

  return (
    <div className={styles.backdrop}>
      <div role="dialog" aria-modal="true" aria-label="Mark absence" className={styles.dialog}>
        <h2 className={styles.title}>Mark absence</h2>
        <div className={styles.subtitle}>{`${fullName(employee)} · ${format(parseIsoDate(date), 'EEE, MMM d')}`}</div>
        <fieldset className={styles.types}>
          <legend className={styles.label}>Type</legend>
          {TYPES.map((type) => (
            <label key={type} className={styles.type}>
              <input
                type="radio"
                name="absenceType"
                value={type}
                checked={absenceType === type}
                onChange={() => setAbsenceType(type)}
              />
              {type}
            </label>
          ))}
        </fieldset>
        <label className={styles.field}>
          Comment
          <textarea className={styles.comment} value={comment} onChange={(event) => setComment(event.target.value)} />
        </label>
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.primary}`}
            onClick={() => onSave({ absenceType, absenceComment: comment.trim() ? comment : null })}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
