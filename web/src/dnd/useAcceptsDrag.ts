import { useDragOperation } from '@dnd-kit/react'
import { ACCEPTS } from './dropResolution'
import type { DragData, DropData } from './dropResolution'

export function useAcceptsDrag(kind: DropData['kind']): boolean {
  const { source } = useDragOperation()
  return !!source && ACCEPTS[kind].includes(source.type as DragData['kind'])
}
