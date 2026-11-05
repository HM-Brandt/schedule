import styles from './App.module.css'
import { useWeek } from './board/useWeek'
import { WeekBoard } from './board/WeekBoard'
import { WeekHeader } from './board/WeekHeader'

/** Página inicial de la aplicación: el encabezado y el tablero de la semana visible. */
function App() {
  const week = useWeek()

  return (
    <main className={styles.app}>
      <h1 className={styles.title}>Weekly schedule</h1>
      <WeekHeader
        from={week.from}
        to={week.to}
        onPrevious={week.goPrevious}
        onNext={week.goNext}
        onToday={week.goToday}
      />
      <WeekBoard days={week.days} today={week.today} />
    </main>
  )
}

export default App
