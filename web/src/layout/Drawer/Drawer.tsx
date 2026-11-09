import { useDragOperation } from '@dnd-kit/react'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import styles from './Drawer.module.css'

export function Drawer({
  side,
  label,
  onClose,
  children,
}: {
  side: 'left' | 'right'
  label: string
  onClose: () => void
  children: ReactNode
}) {
  const { source } = useDragOperation()

  return (
    <div role="dialog" aria-label={label} className={[styles.drawer, styles[side], source && styles.away].filter(Boolean).join(' ')}>
      <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
        <X />
      </button>
      <div className={styles.body}>{children}</div>
    </div>
  )
}
