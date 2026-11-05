import { useMemo } from 'react'
import styles from './App.module.css'
import { useEmployees, useWeekSchedules } from './api/queries'
import { useWeek } from './board/useWeek'
import { WeekBoard } from './board/WeekBoard'
import { WeekHeader } from './board/WeekHeader'
import { JobCatalog } from './catalog/JobCatalog'
import { ScheduleDndProvider } from './dnd/ScheduleDndProvider'
import { jobWeekCounts, schedulesByDay } from './lib/selectors'

/** Página inicial de la aplicación: el catálogo de trabajos y, a su derecha, el encabezado y el tablero de la semana visible. */
function App() {
  const week = useWeek()
  const schedules = useWeekSchedules(week.from, week.to)
  const employees = useEmployees()

  const employeesById = useMemo(
    () => new Map((employees.data ?? []).map((employee) => [employee.id, employee])),
    [employees.data],
  )
  const byDay = useMemo(() => schedulesByDay(schedules.data ?? [], week.days), [schedules.data, week.days])
  const counts = useMemo(() => jobWeekCounts(schedules.data ?? []), [schedules.data])

  return (
    <main className={styles.app}>
      <h1 className={styles.title}>Weekly schedule</h1>
      <ScheduleDndProvider schedules={schedules.data ?? []}>
        <div className={styles.layout}>
          <aside>
            <JobCatalog counts={counts} />
          </aside>
          <div>
            <WeekHeader
              from={week.from}
              to={week.to}
              onPrevious={week.goPrevious}
              onNext={week.goNext}
              onToday={week.goToday}
            />
            {schedules.error && (
              <p role="alert" className={styles.error}>
                Couldn't load the week. {schedules.error.message}
              </p>
            )}
            <WeekBoard days={week.days} today={week.today} schedulesByDay={byDay} employeesById={employeesById} />
          </div>
        </div>
      </ScheduleDndProvider>
    </main>
  )
}

export default App
