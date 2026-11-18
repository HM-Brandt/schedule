import { useDroppable } from '@dnd-kit/react'
import type { IsoDate } from '../../api/types'
import { ACCEPTS } from '../../dnd/dropResolution'
import { useAcceptsDrag } from '../../dnd/useAcceptsDrag'
import { dayOfMonth, formatDayName } from '../../lib/dates'
import styles from './DayStrip.module.css'

function StripDay({
  date,
  isToday,
  isSelected,
  count,
  onSelect,
}: {
  date: IsoDate
  isToday: boolean
  isSelected: boolean
  count: number
  onSelect: (date: IsoDate) => void
}) {
  const { ref, isDropTarget } = useDroppable({ id: `strip-${date}`, type: 'day', accept: ACCEPTS.day, data: { kind: 'day', date } })
  const accepting = useAcceptsDrag('day')

  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={isSelected}
      className={[styles.day, isToday && styles.today, accepting && styles.accepting, isDropTarget && styles.over]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onSelect(date)}
    >
      <span className={styles.name}>{formatDayName(date)}</span>
      <span className={styles.number}>{dayOfMonth(date)}</span>
      <span className={styles.count} aria-label={count === 1 ? '1 job' : `${count} jobs`}>
        {count}
      </span>
    </button>
  )
}

export function DayStrip({
  days,
  today,
  selected,
  counts,
  onSelect,
}: {
  days: IsoDate[]
  today: IsoDate
  selected: IsoDate
  counts: Record<IsoDate, number>
  onSelect: (date: IsoDate) => void
}) {
  return (
    <div className={styles.strip}>
      {days.map((day) => (
        <StripDay
          key={day}
          date={day}
          isToday={day === today}
          isSelected={day === selected}
          count={counts[day]}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
