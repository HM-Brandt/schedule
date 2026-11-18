import { useDragDropMonitor, useDragOperation } from '@dnd-kit/react'
import type { ReactNode } from 'react'
import styles from './BottomSheet.module.css'

export function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { source } = useDragOperation()
  useDragDropMonitor({ onDragEnd: () => onClose() })

  return (
    <div role="dialog" aria-label={title} className={source ? `${styles.sheet} ${styles.away}` : styles.sheet}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <button type="button" className={styles.button} onClick={onClose}>
          Done
        </button>
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  )
}
