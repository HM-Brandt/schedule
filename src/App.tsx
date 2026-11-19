import { BriefcaseBusiness, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import styles from './App.module.css'
import { useEmployees, useHoursSummary, useWeekAbsences, useWeekSchedules } from './api/queries'
import type { Schedule } from './api/types'
import { DayColumn } from './board/DayColumn'
import { DayStrip } from './board/DayStrip'
import { useWeek } from './board/useWeek'
import { WeekBoard } from './board/WeekBoard'
import { WeekHeader } from './board/WeekHeader'
import { JobCatalog } from './catalog/JobCatalog'
import { ScheduleDetail } from './detail/ScheduleDetail'
import { ScheduleDndProvider } from './dnd/ScheduleDndProvider'
import { AssignSheet } from './employees/AssignSheet'
import { EmployeePanel } from './employees/EmployeePanel'
import { AppHeader } from './layout/AppHeader'
import { BottomSheet } from './layout/BottomSheet'
import { Drawer } from './layout/Drawer'
import { useLayout } from './layout/useLayout'
import { absencesByDay, jobWeekCounts, schedulesByDay } from './lib/selectors'
import { UndoProvider } from './undo/UndoProvider'
import { UndoToast } from './undo/UndoToast'
import { useUndoShortcut } from './undo/useUndoShortcut'

function UndoShortcut() {
  useUndoShortcut()
  return null
}

/** Página inicial de la aplicación: el catálogo de trabajos y, a su derecha, el encabezado y el tablero de la semana visible. */
function App() {
  const week = useWeek()
  const layout = useLayout()
  const schedules = useWeekSchedules(week.from, week.to)
  const employees = useEmployees()
  const hours = useHoursSummary(week.from, week.to)
  const absences = useWeekAbsences(week.from, week.to)
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null)

  const employeesById = useMemo(
    () => new Map((employees.data ?? []).map((employee) => [employee.employeesId, employee])),
    [employees.data],
  )
  const byDay = useMemo(() => schedulesByDay(schedules.data ?? [], week.days), [schedules.data, week.days])
  const counts = useMemo(() => jobWeekCounts(schedules.data ?? []), [schedules.data])
  const absencesOfDay = useMemo(() => absencesByDay(absences.data ?? [], week.days), [absences.data, week.days])

  const defaultDay = week.days.includes(week.today) ? week.today : week.from
  const [visible, setVisible] = useState({ from: week.from, day: defaultDay })
  if (visible.from !== week.from) setVisible({ from: week.from, day: defaultDay })
  const [sheet, setSheet] = useState<'jobs' | 'employees' | null>(null)
  const [assigning, setAssigning] = useState<Schedule | null>(null)

  const header = (
    <>
      <WeekHeader from={week.from} to={week.to} onPrevious={week.goPrevious} onNext={week.goNext} onToday={week.goToday}>
        {layout === 'tablet' && (
          <>
            <button
              type="button"
              className={styles.toggle}
              aria-expanded={sheet === 'jobs'}
              onClick={() => setSheet(sheet === 'jobs' ? null : 'jobs')}
            >
              <BriefcaseBusiness />
              Jobs
            </button>
            <button
              type="button"
              className={styles.toggle}
              aria-expanded={sheet === 'employees'}
              onClick={() => setSheet(sheet === 'employees' ? null : 'employees')}
            >
              <Users />
              Employees
            </button>
          </>
        )}
      </WeekHeader>
      {schedules.error && (
        <p role="alert" className={styles.error}>
          Couldn't load the week. {schedules.error.message}
        </p>
      )}
    </>
  )
  const openSchedule = (schedule: Schedule) => setSelectedScheduleId(schedule.jobSchedulesId)
  const board = (
    <WeekBoard
      days={week.days}
      today={week.today}
      schedulesByDay={byDay}
      absencesByDay={absencesOfDay}
      employeesById={employeesById}
      onOpenSchedule={openSchedule}
    />
  )
  const catalog = <JobCatalog counts={counts} />
  const employeePanel = (
    <EmployeePanel
      employees={employees.data ?? []}
      error={employees.error}
      schedules={schedules.data ?? []}
      days={week.days}
      today={week.today}
      hours={hours.data}
    />
  )

  return (
    <UndoProvider>
      <UndoShortcut />
      <main className={styles.app}>
        <AppHeader />
        <ScheduleDndProvider schedules={schedules.data ?? []} absences={absences.data ?? []}>
          {layout === 'desktop' && (
            <div className={styles.layout}>
              <aside>{catalog}</aside>
              <div>
                {header}
                {board}
              </div>
              <aside>{employeePanel}</aside>
            </div>
          )}
          {layout === 'tablet' && (
            <>
              {header}
              {board}
              {sheet === 'jobs' && (
                <Drawer side="left" label="Jobs" onClose={() => setSheet(null)}>
                  {catalog}
                </Drawer>
              )}
              {sheet === 'employees' && (
                <Drawer side="right" label="Employees" onClose={() => setSheet(null)}>
                  {employeePanel}
                </Drawer>
              )}
            </>
          )}
          {layout === 'phone' && (
            <>
              {header}
              <DayStrip
                days={week.days}
                today={week.today}
                selected={visible.day}
                counts={Object.fromEntries(week.days.map((day) => [day, byDay[day].length]))}
                onSelect={(day) => setVisible({ from: week.from, day })}
              />
              <DayColumn
                key={visible.day}
                date={visible.day}
                isToday={visible.day === week.today}
                schedules={byDay[visible.day]}
                absences={absencesOfDay[visible.day]}
                employeesById={employeesById}
                onOpenSchedule={openSchedule}
                onAssignSchedule={setAssigning}
              />
              <div className={styles.bar}>
                <button type="button" className={styles.barButton} onClick={() => setSheet('jobs')}>
                  <BriefcaseBusiness />
                  Jobs
                </button>
                <button type="button" className={styles.barButton} onClick={() => setSheet('employees')}>
                  <Users />
                  Employees
                </button>
              </div>
              {sheet === 'jobs' && (
                <BottomSheet title="Jobs" onClose={() => setSheet(null)}>
                  {catalog}
                </BottomSheet>
              )}
              {sheet === 'employees' && (
                <BottomSheet title="Employees" onClose={() => setSheet(null)}>
                  {employeePanel}
                </BottomSheet>
              )}
              {assigning && (
                <AssignSheet
                  schedule={assigning}
                  employees={employees.data ?? []}
                  schedules={schedules.data ?? []}
                  days={week.days}
                  today={week.today}
                  onClose={() => setAssigning(null)}
                />
              )}
            </>
          )}
        </ScheduleDndProvider>
        {selectedScheduleId !== null && (
          <ScheduleDetail
            scheduleId={selectedScheduleId}
            schedules={schedules.data ?? []}
            absences={absences.data ?? []}
            days={week.days}
            employeesById={employeesById}
            onClose={() => setSelectedScheduleId(null)}
          />
        )}
        <UndoToast />
      </main>
    </UndoProvider>
  )
}

export default App
