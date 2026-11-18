import { useDragOperation } from '@dnd-kit/react'
import type { DragData } from './dropResolution'

export function useDraggedEmployeeId(): number | null {
  const { source } = useDragOperation()
  const data = source?.data as DragData | undefined
  return data?.kind === 'employee' ? data.employeeId : null
}
