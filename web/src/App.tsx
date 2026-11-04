import styles from './App.module.css'

/** Página inicial de la aplicación. Por ahora solo es un contenedor sin lógica. */
function App() {
  return (
    <main className={styles.app}>
      <h1 className={styles.title}>Planificación semanal</h1>
      <p className={styles.text}>El tablero semanal llegará en las próximas fases.</p>
    </main>
  )
}

export default App
