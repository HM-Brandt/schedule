import { useMemo, useState } from 'react'
import { getWeekDays, getWeekRange, shiftWeek, toIsoDate } from '../lib/dates'

export function useWeek() {
  const [today] = useState(() => toIsoDate(new Date()))
  const [from, setFrom] = useState(() => getWeekRange(today).from)
  const days = useMemo(() => getWeekDays(from), [from])

  return {
    from,
    to: days[6],
    days,
    today,
    goPrevious: () => setFrom(shiftWeek(from, -1)),
    goNext: () => setFrom(shiftWeek(from, 1)),
    goToday: () => setFrom(getWeekRange(today).from),
  }
}
