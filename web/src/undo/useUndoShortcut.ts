import { useEffect } from 'react'
import { useUndo } from './UndoProvider'

export function useUndoShortcut() {
  const { undo } = useUndo()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== 'z') return
      if (event.target instanceof Element && event.target.matches('input, select, textarea')) return
      event.preventDefault()
      undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo])
}
