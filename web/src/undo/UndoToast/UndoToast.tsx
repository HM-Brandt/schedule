import { CircleAlert, Undo2, X } from 'lucide-react'
import { useEffect } from 'react'
import { useUndo } from '../UndoProvider'
import styles from './UndoToast.module.css'

export function UndoToast() {
  const { toast, dismiss, undo } = useUndo()

  useEffect(() => {
    if (toast?.kind !== 'action') return
    const timer = setTimeout(dismiss, 5000)
    return () => clearTimeout(timer)
  }, [toast, dismiss])

  if (!toast) return null
  if (toast.kind === 'error') {
    return (
      <div role="alert" className={`${styles.toast} ${styles.error}`}>
        <CircleAlert />
        {toast.message}
        <button type="button" className={styles.button} onClick={dismiss}>
          <X />
          Dismiss
        </button>
      </div>
    )
  }
  return (
    <div role="status" className={styles.toast}>
      {toast.message}
      <button type="button" className={styles.button} onClick={undo}>
        <Undo2 />
        Undo
      </button>
    </div>
  )
}
