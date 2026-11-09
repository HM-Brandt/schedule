// Tests de `useDraggedEmployeeId` (tarea 7.4 de `schedule-assign`).
//
// El hook da el id del empleado que se está arrastrando, venga del panel o de una tarjeta,
// y `null` si no hay arrastre o si lo que se arrastra no es un empleado. Con él cada día
// calcula el indicador de carga de la decisión 5 de `design.md`.
//
// Se usa el `DragDropProvider` real de @dnd-kit/react con un origen de cada tipo, y el
// arrastre se maneja con las acciones del gestor (ver `src/test/dnd.ts`).
import { DragDropProvider, useDraggable } from '@dnd-kit/react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Schedule } from '../api/types'
import { CapturadorDelGestor, empezarArrastre, gestorActual, simularApisDeArrastre } from '../test/dnd'
import type { DragData } from './dropResolution'
import { useDraggedEmployeeId } from './useDraggedEmployeeId'

simularApisDeArrastre()

const PINTAR_OFICINA = { id: 7, number: 'J-1024', name: 'Pintar oficina' }
const TARJETA: Schedule = { id: 1, job: PINTAR_OFICINA, date: '2026-11-02', start_time: '07:00', employee_ids: [3, 5] }

const ORIGENES: Record<string, DragData> = {
  'trabajo-del-catalogo': { kind: 'catalog-job', job: PINTAR_OFICINA },
  tarjeta: { kind: 'schedule-card', schedule: TARJETA },
  // Ana López (3) desde el panel.
  'ana-del-panel': { kind: 'employee', employeeId: 3 },
  // Luis Martínez (5) desde la tarjeta 1.
  'luis-de-la-tarjeta': { kind: 'employee', employeeId: 5, fromScheduleId: 1 },
}

function Origen({ id, data }: { id: string; data: DragData }) {
  const { ref } = useDraggable({ id, type: data.kind, data })
  return <div ref={ref}>{id}</div>
}

/** Muestra lo que devuelve el hook: el id o "null". */
function Sonda() {
  return <output data-testid="empleado">{String(useDraggedEmployeeId())}</output>
}

function renderSonda() {
  render(
    <DragDropProvider>
      <CapturadorDelGestor />
      {Object.entries(ORIGENES).map(([id, data]) => (
        <Origen key={id} id={id} data={data} />
      ))}
      <Sonda />
    </DragDropProvider>,
  )
}

const valor = () => screen.getByTestId('empleado').textContent

describe('useDraggedEmployeeId', () => {
  it('sin ningún arrastre en curso devuelve null', () => {
    renderSonda()

    expect(valor()).toBe('null')
  })

  it('arrastrando un trabajo del catálogo devuelve null', async () => {
    renderSonda()

    await empezarArrastre('trabajo-del-catalogo')

    expect(valor()).toBe('null')
  })

  it('arrastrando una tarjeta de programación devuelve null', async () => {
    renderSonda()

    await empezarArrastre('tarjeta')

    expect(valor()).toBe('null')
  })

  it('arrastrando a Ana desde el panel devuelve su id, 3', async () => {
    renderSonda()

    await empezarArrastre('ana-del-panel')

    await waitFor(() => expect(valor()).toBe('3'))
  })

  it('arrastrando a Luis desde una tarjeta devuelve su id, 5', async () => {
    renderSonda()

    await empezarArrastre('luis-de-la-tarjeta')

    await waitFor(() => expect(valor()).toBe('5'))
  })

  it('al terminar el arrastre de un empleado vuelve a null', async () => {
    renderSonda()
    await empezarArrastre('ana-del-panel')
    await waitFor(() => expect(valor()).toBe('3'))

    await act(async () => {
      gestorActual().actions.stop({ canceled: true })
    })

    await waitFor(() => expect(valor()).toBe('null'))
  })
})
